import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Store } from "../src/store.js";
import { Vault } from "../src/vault.js";
import { createApp } from "../src/app.js";
import { MediaService } from "../src/services/media.js";
import { ProviderRegistry } from "../src/services/providers/registry.js";

const testConfig = {
  env: "test",
  root: process.cwd(),
  corsOrigins: ["http://localhost:5173"],
  trustProxy: 0,
  databaseUrl: "",
  jwtSecret: "test-secret-that-is-long-enough-for-verification",
  jwtExpiresIn: "1h",
  admin: {
    email: "admin@test.local",
    password: "Strong!Test#Password1",
    name: "Test Admin",
  },
  youtubeApiKey: "",
  youtubeCacheSeconds: 10_800,
  fetchTimeoutMs: 1_000,
  newsApiKey: "",
  ai: { apiKey: "", baseUrl: "", model: "test-model" },
  windyApiKey: "",
  finnhubApiKey: "",
  firmsApiKey: "",
  firms: { sources: ["VIIRS_SNPP_NRT"], area: "world", cacheSeconds: 60 },
  acled: { accessToken: "", email: "", password: "" },
  aisStreamApiKey: "",
  openSky: { clientId: "", clientSecret: "", bbox: [-10, -30, 70, 60] },
  cloudflareApiToken: "",
  eiaApiKey: "",
  fredApiKey: "",
  weatherApiKey: "",
};

const snapshot = {
  earthquakes: [
    {
      id: "quake-1",
      title: "M 5.1 test event",
      summary: "Test source event",
      category: "seismic",
      severity: "high",
      status: "verified",
      region: "Global",
      country: "Test",
      latitude: 1,
      longitude: 2,
      magnitude: 5.1,
      sourceName: "USGS",
      sourceUrl: "https://example.com",
      publishedAt: new Date().toISOString(),
    },
  ],
  weather: [],
  natural: [
    {
      id: "eonet-1",
      title: "Test natural event",
      summary: "A deterministic NASA EONET test fixture.",
      category: "natural",
      severity: "medium",
      status: "monitoring",
      region: "Global",
      country: "Wildfires",
      latitude: 3,
      longitude: 4,
      sourceName: "NASA EONET",
      sourceUrl: "https://example.com/eonet",
      publishedAt: new Date().toISOString(),
    },
  ],
  news: [],
  sourceStatus: [{ id: "usgs", name: "USGS", status: "operational" }],
  fetchedAt: new Date().toISOString(),
};

let app;
let store;
let token;
let vault;

beforeAll(async () => {
  store = await new Store({
    databaseUrl: "",
    databaseSsl: false,
    localDataFile: ":memory:",
    admin: testConfig.admin,
  }).init();
  vault = await new Vault(testConfig, store).load();
  const mediaService = new MediaService(testConfig);
  const intelligenceService = {
    generate: async () => ({
      headline: "Test brief",
      assessment: ["Verified test output"],
      watchlist: [],
      confidence: "rules-based",
    }),
    lastSuccessAt: null,
  };
  app = createApp({
    config: testConfig,
    store,
    liveSources: { snapshot: async () => snapshot },
    intelligence: intelligenceService,
    media: mediaService,
    providers: new ProviderRegistry(testConfig, {
      media: mediaService,
      liveSources: { snapshot: async () => snapshot },
      intelligence: intelligenceService,
    }),
    vault,
  });
});

afterAll(async () => store.close());

describe("public API", () => {
  it("returns a health response without exposing secrets", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(JSON.stringify(response.body)).not.toContain(testConfig.jwtSecret);
  });

  it("permits the deployed same origin and rejects an unrelated browser origin", async () => {
    await request(app)
      .get("/api/health")
      .set("Host", "worldgpz.onrender.com")
      .set("Origin", "https://worldgpz.onrender.com")
      .expect(200)
      .expect("access-control-allow-origin", "https://worldgpz.onrender.com");
    await request(app)
      .get("/api/health")
      .set("Host", "worldgpz.onrender.com")
      .set("Origin", "https://attacker.example")
      .expect(403);
  });

  it("labels curated baseline rows and reports feed provenance", async () => {
    const response = await request(app).get("/api/v1/dashboard").expect(200);
    const { provenance, events } = response.body.data;

    // Every bundled baseline row must be flagged, never presented as live.
    const baseline = events.filter((event) =>
      String(event.id ?? "").startsWith("baseline-"),
    );
    expect(baseline.length).toBeGreaterThan(0);
    expect(baseline.every((event) => event.curated === true)).toBe(true);

    // Live rows must not be flagged.
    const live = events.filter(
      (event) => !String(event.id ?? "").startsWith("baseline-"),
    );
    expect(live.every((event) => event.curated === false)).toBe(true);

    expect(provenance.total).toBe(events.length);
    expect(provenance.live + provenance.curated).toBe(provenance.total);
    expect(provenance.curated).toBe(baseline.length);
    expect(typeof provenance.note).toBe("string");
    expect(provenance.note.length).toBeGreaterThan(0);
  });

  it("returns dashboard data from curated and live sources", async () => {
    const response = await request(app).get("/api/v1/dashboard").expect(200);
    expect(response.body.data.metrics.activeSignals).toBeGreaterThan(1);
    expect(
      response.body.data.events.some((event) => event.sourceName === "USGS"),
    ).toBe(true);
    expect(
      response.body.data.events.some(
        (event) => event.sourceName === "NASA EONET",
      ),
    ).toBe(true);
    expect(response.body.data.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "natural", count: 1 }),
      ]),
    );
    expect(Array.isArray(response.body.data.regions)).toBe(true);
    expect(Array.isArray(response.body.data.correlations)).toBe(true);
  });

  it("returns a safe media capability response when YouTube is unconfigured", async () => {
    const response = await request(app)
      .get("/api/v1/media/channels")
      .expect(200);
    expect(response.body.data.configured).toBe(false);
    expect(response.body.data.channels.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain("youtubeApiKey");
  });

  it("rejects invalid event filters safely", async () => {
    const response = await request(app)
      .get("/api/v1/events?q=%25%27%20OR%201%3D1")
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});

describe("extended provider API", () => {
  const endpoints = [
    "/api/v1/webcams",
    "/api/v1/markets",
    "/api/v1/fires",
    "/api/v1/conflicts",
    "/api/v1/ships",
    "/api/v1/flights",
    "/api/v1/outages",
    "/api/v1/energy",
    "/api/v1/macro",
    "/api/v1/weather",
  ];

  it.each(endpoints)(
    "gracefully reports not-configured when no key is set (%s)",
    async (endpoint) => {
      const response = await request(app).get(endpoint).expect(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.configured).toBe(false);
      expect(response.body.data.status).toBe("not-configured");
    },
  );

  it("reports every provider without leaking secrets", async () => {
    const response = await request(app).get("/api/v1/providers").expect(200);
    const providers = response.body.data;
    expect(providers.length).toBe(13);
    for (const provider of providers) {
      expect(provider).toHaveProperty("id");
      expect(provider).toHaveProperty("name");
      expect(provider).toHaveProperty("status");
      expect(provider).toHaveProperty("configured");
    }
    const serialized = JSON.stringify(providers);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("Bearer ");
  });

  it("keeps extended providers out of the dashboard when unconfigured", async () => {
    const response = await request(app).get("/api/v1/dashboard").expect(200);
    expect(
      response.body.data.events.some(
        (event) => event.sourceName === "NASA FIRMS",
      ),
    ).toBe(false);
    expect(
      response.body.data.events.some((event) => event.sourceName === "ACLED"),
    ).toBe(false);
  });
});

describe("authentication and admin API", () => {
  it("does not accept an incorrect password", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: testConfig.admin.email, password: "incorrect-password" })
      .expect(401);
  });

  it("authenticates the seeded administrator", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testConfig.admin.email,
        password: testConfig.admin.password,
      })
      .expect(200);
    token = response.body.token;
    expect(response.body.user.role).toBe("admin");
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it("authenticates by the plain operator username", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        username: "admin",
        password: testConfig.admin.password,
      })
      .expect(200);
    expect(response.body.user.role).toBe("admin");
    expect(response.body.user.email).toBe(testConfig.admin.email);
  });

  it("rejects an unknown operator identifier", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ username: "ghost", password: testConfig.admin.password })
      .expect(401);
  });

  it("protects administrator endpoints", async () => {
    await request(app).get("/api/admin/overview").expect(401);
    const response = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(response.body.data.stats.totalEvents).toBeGreaterThan(0);
  });

  it("validates, creates, updates, and deletes an event", async () => {
    await request(app)
      .post("/api/admin/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "bad" })
      .expect(400);
    const payload = {
      title: "Verified integration test event",
      summary: "A complete event created by the API integration test.",
      category: "diplomacy",
      severity: "low",
      status: "verified",
      region: "Test region",
      country: "Test country",
      latitude: 10,
      longitude: 20,
      sourceName: "Test suite",
      sourceUrl: "https://example.com/source",
    };
    const created = await request(app)
      .post("/api/admin/events")
      .set("Authorization", `Bearer ${token}`)
      .send(payload)
      .expect(201);
    const id = created.body.data.id;
    const updated = await request(app)
      .patch(`/api/admin/events/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ severity: "medium" })
      .expect(200);
    expect(updated.body.data.severity).toBe("medium");
    await request(app)
      .delete(`/api/admin/events/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });
});

describe("secure uplink vault (admin API keys)", () => {
  beforeAll(async () => {
    if (!token) {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "admin",
          password: testConfig.admin.password,
        })
        .expect(200);
      token = response.body.token;
    }
  });

  it("requires authentication", async () => {
    await request(app).get("/api/admin/keys").expect(401);
    await request(app)
      .put("/api/admin/keys")
      .send({ keys: { NEWS_API_KEY: "x" } })
      .expect(401);
  });

  it("returns every registry entry masked, never in plaintext", async () => {
    const response = await request(app)
      .get("/api/admin/keys")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(17);
    for (const entry of response.body.data) {
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("label");
      expect(entry).toHaveProperty("group");
      expect(["vault", "environment", "unset"]).toContain(entry.source);
    }
    const serialized = JSON.stringify(response.body.data);
    expect(serialized).not.toContain("hunter2-never-appears");
  });

  it("persists saved keys, masks them, and applies them to live config", async () => {
    const response = await request(app)
      .put("/api/admin/keys")
      .set("Authorization", `Bearer ${token}`)
      .send({ keys: { NEWS_API_KEY: "hunter2-never-appears" } })
      .expect(200);
    const saved = response.body.data.find(
      (entry) => entry.id === "NEWS_API_KEY",
    );
    expect(saved.source).toBe("vault");
    expect(saved.configured).toBe(true);
    expect(saved.masked).toMatch(/ears$/);
    // Live config mutated immediately — no restart required.
    expect(testConfig.newsApiKey).toBe("hunter2-never-appears");
    // Plaintext never leaves the endpoint.
    expect(JSON.stringify(response.body)).not.toContain("hunter2-never");

    // Durable across a fresh vault boot (same store = same database).
    const reborn = await new Vault(testConfig, store).load();
    expect(
      reborn.view().find((entry) => entry.id === "NEWS_API_KEY").source,
    ).toBe("vault");

    // Audit trail records which keys changed — not their values.
    const audits = await store.listAudits(10);
    const entry = audits.find((item) => item.action === "settings.update");
    expect(entry).toBeTruthy();
    expect(entry.metadata.keys).toContain("NEWS_API_KEY");
    expect(JSON.stringify(entry)).not.toContain("hunter2");
  });

  it("clears a key back to the environment fallback", async () => {
    const response = await request(app)
      .put("/api/admin/keys")
      .set("Authorization", `Bearer ${token}`)
      .send({ keys: { NEWS_API_KEY: "" } })
      .expect(200);
    const cleared = response.body.data.find(
      (entry) => entry.id === "NEWS_API_KEY",
    );
    expect(cleared.source).toBe("unset");
    expect(testConfig.newsApiKey).toBe("");
  });

  it("rejects unknown keys and malformed payloads", async () => {
    await request(app)
      .put("/api/admin/keys")
      .set("Authorization", `Bearer ${token}`)
      .send({ keys: { NOT_A_REAL_KEY: "x" } })
      .expect(400);
    await request(app)
      .put("/api/admin/keys")
      .set("Authorization", `Bearer ${token}`)
      .send({ keys: {} })
      .expect(400);
    await request(app)
      .put("/api/admin/keys")
      .set("Authorization", `Bearer ${token}`)
      .send({ keys: { AI_MODEL: "x".repeat(401) } })
      .expect(400);
  });

  it("reports honest persistence metadata", async () => {
    const response = await request(app)
      .get("/api/admin/keys")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const persistence = response.body.meta.persistence;
    expect(persistence).toHaveProperty("tier");
    expect(persistence).toHaveProperty("survivesRedeploy");
    expect(persistence).toHaveProperty("survivesMachineChange");
    expect(typeof persistence.survivesRedeploy).toBe("boolean");
  });

  it("exports an encrypted blob that carries no plaintext", async () => {
    await request(app)
      .put("/api/admin/keys")
      .set("Authorization", `Bearer ${token}`)
      .send({ keys: { FINNHUB_API_KEY: "plain-finnhub-secret" } })
      .expect(200);

    const response = await request(app)
      .get("/api/admin/keys/export")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.envKey).toBe("WORLDGPZ_VAULT");
    expect(response.body.data.blob.startsWith("wgv1.")).toBe(true);
    expect(response.body.data.keyCount).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(response.body)).not.toContain("plain-finnhub-secret");
  });

  it("restores a vault on a second machine via import", async () => {
    const exported = await request(app)
      .get("/api/admin/keys/export")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const blob = exported.body.data.blob;

    // Simulate a different deployment: fresh config + fresh store, same JWT.
    const remoteConfig = {
      ...testConfig,
      newsApiKey: "",
      finnhubApiKey: "",
    };
    const remoteStore = await new Store({
      localDataFile: ":memory:",
      admin: testConfig.admin,
    }).init();
    const remoteVault = await new Vault(remoteConfig, remoteStore).load();
    expect(remoteConfig.finnhubApiKey).toBe("");

    const result = await remoteVault.import(blob);
    expect(result.touched).toContain("FINNHUB_API_KEY");
    expect(remoteConfig.finnhubApiKey).toBe("plain-finnhub-secret");
  });

  it("guards the import endpoint against bad input", async () => {
    await request(app)
      .post("/api/admin/keys/import")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(400);
    await request(app)
      .post("/api/admin/keys/import")
      .set("Authorization", `Bearer ${token}`)
      .send({ blob: "wgv1.not.a.real.blob" })
      .expect(400);
    await request(app).post("/api/admin/keys/import").expect(401);
  });
});
