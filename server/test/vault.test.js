import { describe, it, expect } from "vitest";
import { encryptVault, decryptVault } from "../src/vaultCrypto.js";
import { Vault, KEY_REGISTRY } from "../src/vault.js";

const SECRET = "test-vault-secret-0123456789abcdef";

/** Minimal in-memory store matching the Store contract. */
const memoryStore = (initial = {}) => {
  let settings = { ...initial };
  return {
    kind: "memory",
    writes: 0,
    async getSettings() {
      return { ...settings };
    },
    async saveSettings(next) {
      settings = { ...next };
      this.writes += 1;
      return { ...settings };
    },
  };
};

const baseConfig = () => ({
  newsApiKey: "",
  youtubeApiKey: "",
  weatherApiKey: "",
  windyApiKey: "",
  finnhubApiKey: "",
  firmsApiKey: "",
  aisStreamApiKey: "",
  cloudflareApiToken: "",
  eiaApiKey: "",
  fredApiKey: "",
  vaultBlob: "",
  vaultSecret: SECRET,
  ai: {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  acled: { accessToken: "", email: "", password: "" },
  openSky: { clientId: "", clientSecret: "" },
});

describe("vaultCrypto", () => {
  it("round-trips a settings object", () => {
    const settings = { NEWS_API_KEY: "abc", FINNHUB_API_KEY: "xyz" };
    const blob = encryptVault(settings, SECRET);
    expect(blob.startsWith("wgv1.")).toBe(true);
    expect(decryptVault(blob, SECRET)).toEqual(settings);
  });

  it("produces different ciphertext each time (random salt/iv)", () => {
    const settings = { NEWS_API_KEY: "same" };
    expect(encryptVault(settings, SECRET)).not.toBe(
      encryptVault(settings, SECRET),
    );
  });

  it("never leaks the plaintext key into the blob", () => {
    const blob = encryptVault({ NEWS_API_KEY: "super-secret-value" }, SECRET);
    expect(blob).not.toContain("super-secret-value");
  });

  it("rejects the wrong secret", () => {
    const blob = encryptVault({ NEWS_API_KEY: "abc" }, SECRET);
    expect(() =>
      decryptVault(blob, "a-completely-different-secret-9999"),
    ).toThrow(/wrong secret or corrupted/i);
  });

  it("rejects a tampered blob", () => {
    const blob = encryptVault({ NEWS_API_KEY: "abc" }, SECRET);
    const parts = blob.split(".");
    // Corrupt the authentication tag: GCM must reject the whole blob.
    const tag = parts[3];
    parts[3] = (tag[0] === "A" ? "B" : "A") + tag.slice(1);
    expect(() => decryptVault(parts.join("."), SECRET)).toThrow(
      /wrong secret or corrupted/i,
    );

    // Corrupt the ciphertext itself (first char, so base64 bit-alignment
    // guarantees the decoded bytes actually change).
    const parts2 = blob.split(".");
    const body = parts2[4];
    parts2[4] = (body[0] === "A" ? "B" : "A") + body.slice(1);
    expect(() => decryptVault(parts2.join("."), SECRET)).toThrow();
  });

  it("rejects malformed and wrong-version blobs", () => {
    expect(() => decryptVault("garbage", SECRET)).toThrow(/malformed/i);
    expect(() => decryptVault("", SECRET)).toThrow(/empty/i);
    expect(() => decryptVault("wgv0.a.b.c.d", SECRET)).toThrow(/malformed/i);
  });

  it("refuses a weak encryption secret", () => {
    expect(() => encryptVault({}, "short")).toThrow(/at least 16 characters/i);
  });
});

describe("Vault", () => {
  it("stores keys, applies them to live config, and never returns plaintext", async () => {
    const config = baseConfig();
    const store = memoryStore();
    const vault = await new Vault(config, store).load();

    const { view, touched } = await vault.update({
      NEWS_API_KEY: "sk-news-1234567890",
      AI_MODEL: "gpt-4o",
    });

    expect(touched).toEqual(["NEWS_API_KEY", "AI_MODEL"]);
    // Applied to the live config object providers read from.
    expect(config.newsApiKey).toBe("sk-news-1234567890");
    expect(config.ai.model).toBe("gpt-4o");
    // Persisted to the store.
    expect(store.writes).toBeGreaterThan(0);

    const news = view.find((entry) => entry.id === "NEWS_API_KEY");
    expect(news.configured).toBe(true);
    expect(news.source).toBe("vault");
    expect(news.masked).toBe("••••••••7890");
    expect(JSON.stringify(view)).not.toContain("sk-news-1234567890");
  });

  it("seeds keys from an encrypted env blob on a fresh store", async () => {
    const blob = encryptVault(
      { FINNHUB_API_KEY: "fk-from-env", NEWS_API_KEY: "sk-from-env" },
      SECRET,
    );
    const config = { ...baseConfig(), vaultBlob: blob };
    const vault = await new Vault(config, memoryStore()).load();

    expect(config.finnhubApiKey).toBe("fk-from-env");
    expect(config.newsApiKey).toBe("sk-from-env");
    expect(vault.envSeedCount).toBe(2);
    expect(vault.envSeedError).toBeUndefined();
  });

  it("lets an existing store value win over the env blob", async () => {
    const blob = encryptVault({ NEWS_API_KEY: "from-env" }, SECRET);
    const config = { ...baseConfig(), vaultBlob: blob };
    const store = memoryStore({ NEWS_API_KEY: "from-store" });
    await new Vault(config, store).load();

    expect(config.newsApiKey).toBe("from-store");
  });

  it("ignores unknown ids in the env blob instead of crashing", async () => {
    const blob = encryptVault(
      { NOT_A_REAL_KEY: "x", NEWS_API_KEY: "ok" },
      SECRET,
    );
    const config = { ...baseConfig(), vaultBlob: blob };
    await new Vault(config, memoryStore()).load();
    expect(config.newsApiKey).toBe("ok");
  });

  it("survives a restart when the store is durable", async () => {
    const store = memoryStore();
    const first = await new Vault(baseConfig(), store).load();
    await first.update({ NEWS_API_KEY: "persistent-key" });

    // Simulated process restart: brand new Vault bound to the same store.
    const config2 = baseConfig();
    const second = await new Vault(config2, store).load();
    expect(config2.newsApiKey).toBe("persistent-key");
    expect(second.view().find((e) => e.id === "NEWS_API_KEY").source).toBe(
      "vault",
    );
  });

  it("exports and imports across machines", async () => {
    const machineA = await new Vault(baseConfig(), memoryStore()).load();
    await machineA.update({
      NEWS_API_KEY: "portable-news",
      CLOUDFLARE_API_TOKEN: "portable-cf",
    });

    const blob = machineA.export();
    expect(blob.startsWith("wgv1.")).toBe(true);

    // A different machine, empty store, same secret.
    const configB = baseConfig();
    const machineB = await new Vault(configB, memoryStore()).load();
    const { touched } = await machineB.import(blob);

    expect(touched.sort()).toEqual(["CLOUDFLARE_API_TOKEN", "NEWS_API_KEY"]);
    expect(configB.newsApiKey).toBe("portable-news");
    expect(configB.cloudflareApiToken).toBe("portable-cf");
  });

  it("import does not overwrite existing keys unless asked", async () => {
    const blob = encryptVault({ NEWS_API_KEY: "incoming" }, SECRET);
    const config = baseConfig();
    const vault = await new Vault(config, memoryStore()).load();
    await vault.update({ NEWS_API_KEY: "existing" });

    await vault.import(blob);
    expect(config.newsApiKey).toBe("existing");

    await vault.import(blob, { overwrite: true });
    expect(config.newsApiKey).toBe("incoming");
  });

  it("clearing a key falls back to the environment default", async () => {
    const config = { ...baseConfig(), newsApiKey: "from-environment" };
    const vault = await new Vault(config, memoryStore()).load();

    await vault.update({ NEWS_API_KEY: "vault-override" });
    expect(config.newsApiKey).toBe("vault-override");

    await vault.update({ NEWS_API_KEY: "" });
    expect(config.newsApiKey).toBe("from-environment");
    expect(vault.view().find((e) => e.id === "NEWS_API_KEY").source).toBe(
      "environment",
    );
  });

  it("rejects unknown keys and non-string values", async () => {
    const vault = await new Vault(baseConfig(), memoryStore()).load();
    await expect(vault.update({ BOGUS_KEY: "x" })).rejects.toThrow(/Unknown/);
    await expect(vault.update({ NEWS_API_KEY: 42 })).rejects.toThrow(/string/);
    await expect(
      vault.update({ NEWS_API_KEY: "x".repeat(500) }),
    ).rejects.toThrow(/exceeds/);
  });

  it("reports honest persistence tiers", async () => {
    const ephemeral = await new Vault(baseConfig(), memoryStore()).load();
    expect(ephemeral.persistence.tier).toBe("ephemeral");
    expect(ephemeral.persistence.survivesRedeploy).toBe(false);

    const mongo = await new Vault(baseConfig(), {
      ...memoryStore(),
      kind: "mongodb",
    }).load();
    expect(mongo.persistence.tier).toBe("durable");
    expect(mongo.persistence.backend).toBe("mongodb");

    const envBlob = await new Vault(
      { ...baseConfig(), vaultBlob: encryptVault({}, SECRET) },
      memoryStore(),
    ).load();
    expect(envBlob.persistence.backend).toBe("encrypted-env");
    expect(envBlob.persistence.survivesMachineChange).toBe(true);
  });

  it("covers every registry entry with a resolvable config path", async () => {
    const config = baseConfig();
    const vault = await new Vault(config, memoryStore()).load();
    // If any path were wrong, setPath would throw on a missing intermediate.
    expect(vault.view()).toHaveLength(KEY_REGISTRY.length);
    for (const entry of vault.view()) {
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("source");
    }
  });
});
