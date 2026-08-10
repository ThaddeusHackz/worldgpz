import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Store } from "../src/store.js";
import { createApp } from "../src/app.js";

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
  news: [],
  sourceStatus: [{ id: "usgs", name: "USGS", status: "operational" }],
  fetchedAt: new Date().toISOString(),
};

let app;
let store;
let token;

beforeAll(async () => {
  store = await new Store({
    databaseUrl: "",
    databaseSsl: false,
    localDataFile: ":memory:",
    admin: testConfig.admin,
  }).init();
  app = createApp({
    config: testConfig,
    store,
    liveSources: { snapshot: async () => snapshot },
    intelligence: {
      generate: async () => ({
        headline: "Test brief",
        assessment: ["Verified test output"],
        watchlist: [],
        confidence: "rules-based",
      }),
    },
  });
});

afterAll(async () => store.close());

describe("public API", () => {
  it("returns a health response without exposing secrets", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(JSON.stringify(response.body)).not.toContain(testConfig.jwtSecret);
  });

  it("returns dashboard data from curated and live sources", async () => {
    const response = await request(app).get("/api/v1/dashboard").expect(200);
    expect(response.body.data.metrics.activeSignals).toBeGreaterThan(1);
    expect(
      response.body.data.events.some((event) => event.sourceName === "USGS"),
    ).toBe(true);
  });

  it("rejects invalid event filters safely", async () => {
    const response = await request(app)
      .get("/api/v1/events?q=%25%27%20OR%201%3D1")
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
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
