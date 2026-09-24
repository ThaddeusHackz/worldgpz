/**
 * Secure uplink vault — the admin console's API-key store.
 *
 * Keys pasted into the admin panel are persisted in the database (MongoDB
 * Atlas in production, atomic local JSON in development), applied to the
 * live configuration object at boot, and consumed by every provider adapter
 * at call time. They survive page reloads, container restarts, and work from
 * any machine because they never live in the browser.
 *
 * Plaintext values are NEVER returned by the API — only masked previews and
 * provenance (`vault` | `environment` | `unset`).
 */

const MAX_VALUE_LENGTH = 400;

/** Whitelisted admin-configurable keys, mapped onto live config paths. */
export const KEY_REGISTRY = [
  // News & media
  {
    id: "NEWS_API_KEY",
    label: "NewsAPI",
    group: "News & media",
    path: "newsApiKey",
    kind: "secret",
    hint: "newsapi.org top-headlines key",
  },
  {
    id: "YOUTUBE_API_KEY",
    label: "YouTube Data API",
    group: "News & media",
    path: "youtubeApiKey",
    kind: "secret",
    hint: "Google Cloud key for live-channel discovery",
  },
  {
    id: "OPENWEATHER_API_KEY",
    label: "OpenWeather",
    group: "News & media",
    path: "weatherApiKey",
    kind: "secret",
    hint: "Current-weather watch points",
  },
  // Intelligence
  {
    id: "AI_API_KEY",
    label: "AI provider key",
    group: "Intelligence",
    path: "ai.apiKey",
    kind: "secret",
    hint: "OpenAI-compatible key for generated briefings",
  },
  {
    id: "AI_BASE_URL",
    label: "AI base URL",
    group: "Intelligence",
    path: "ai.baseUrl",
    kind: "text",
    hint: "OpenAI-compatible endpoint root",
  },
  {
    id: "AI_MODEL",
    label: "AI model",
    group: "Intelligence",
    path: "ai.model",
    kind: "text",
    hint: "Model id sent to the AI endpoint",
  },
  // Earth & security
  {
    id: "NASA_FIRMS_API_KEY",
    label: "NASA FIRMS",
    group: "Earth & security",
    path: "firmsApiKey",
    kind: "secret",
    hint: "Satellite fire/thermal detections (MAP key)",
  },
  {
    id: "ACLED_ACCESS_TOKEN",
    label: "ACLED token",
    group: "Earth & security",
    path: "acled.accessToken",
    kind: "secret",
    hint: "Conflict and protest event feed",
  },
  {
    id: "ACLED_EMAIL",
    label: "ACLED email",
    group: "Earth & security",
    path: "acled.email",
    kind: "text",
    hint: "Alternative to token auth",
  },
  {
    id: "ACLED_PASSWORD",
    label: "ACLED password",
    group: "Earth & security",
    path: "acled.password",
    kind: "secret",
    hint: "Alternative to token auth",
  },
  {
    id: "WINDY_API_KEY",
    label: "Windy Webcams",
    group: "Earth & security",
    path: "windyApiKey",
    kind: "secret",
    hint: "Global webcam network",
  },
  // Markets & economy
  {
    id: "FINNHUB_API_KEY",
    label: "Finnhub",
    group: "Markets & economy",
    path: "finnhubApiKey",
    kind: "secret",
    hint: "Equities, indices, and crypto quotes",
  },
  {
    id: "EIA_API_KEY",
    label: "U.S. EIA",
    group: "Markets & economy",
    path: "eiaApiKey",
    kind: "secret",
    hint: "Oil, petroleum, and natural-gas prices",
  },
  {
    id: "FRED_API_KEY",
    label: "FRED",
    group: "Markets & economy",
    path: "fredApiKey",
    kind: "secret",
    hint: "Interest rates and macro indicators",
  },
  // Logistics
  {
    id: "AISSTREAM_API_KEY",
    label: "AISStream",
    group: "Logistics",
    path: "aisStreamApiKey",
    kind: "secret",
    hint: "Live ship positions",
  },
  {
    id: "OPENSKY_CLIENT_ID",
    label: "OpenSky client ID",
    group: "Logistics",
    path: "openSky.clientId",
    kind: "text",
    hint: "Aircraft tracking credentials",
  },
  {
    id: "OPENSKY_CLIENT_SECRET",
    label: "OpenSky client secret",
    group: "Logistics",
    path: "openSky.clientSecret",
    kind: "secret",
    hint: "Aircraft tracking credentials",
  },
  // Systems
  {
    id: "CLOUDFLARE_API_TOKEN",
    label: "Cloudflare Radar",
    group: "Systems",
    path: "cloudflareApiToken",
    kind: "secret",
    hint: "Internet outages and traffic anomalies",
  },
];

const byId = new Map(KEY_REGISTRY.map((entry) => [entry.id, entry]));

const getPath = (object, dotted) =>
  dotted.split(".").reduce((value, key) => value?.[key], object);

const setPath = (object, dotted, value) => {
  const keys = dotted.split(".");
  const last = keys.pop();
  const target = keys.reduce((value, key) => value[key], object);
  target[last] = value;
};

export const maskValue = (value) => {
  if (!value) return null;
  const text = String(value);
  if (text.length <= 4) return "••••";
  return `${"•".repeat(8)}${text.slice(-4)}`;
};

export class Vault {
  /**
   * @param {object} config live configuration object (mutated in place)
   * @param {object} store Store | MongoStore exposing getSettings/saveSettings
   */
  constructor(config, store) {
    this.config = config;
    this.store = store;
    // Environment/defaults snapshot: clearing a vault override falls back here.
    this.envFallback = {};
    for (const entry of KEY_REGISTRY)
      this.envFallback[entry.id] = getPath(config, entry.path) ?? "";
    this.stored = {};
    this.loadedAt = null;
  }

  /** Read persisted settings from the store and apply them to the config. */
  async load() {
    const settings = (await this.store.getSettings?.()) || {};
    this.stored = {};
    for (const [id, value] of Object.entries(settings)) {
      if (byId.has(id) && typeof value === "string" && value.trim() !== "")
        this.stored[id] = value;
    }
    this.apply();
    this.loadedAt = new Date().toISOString();
    return this;
  }

  /** Effective value for an entry: vault override, else environment/default. */
  resolve(entry) {
    const stored = this.stored[entry.id];
    if (typeof stored === "string" && stored.trim() !== "") return stored;
    return this.envFallback[entry.id] ?? "";
  }

  /** Push every effective value onto the live config object. */
  apply() {
    for (const entry of KEY_REGISTRY)
      setPath(this.config, entry.path, this.resolve(entry));
  }

  /** Masked, browser-safe view of every configurable key. */
  view() {
    return KEY_REGISTRY.map((entry) => {
      const hasVault = Boolean(this.stored[entry.id]?.trim());
      const fallback = this.envFallback[entry.id] ?? "";
      const effective = this.resolve(entry);
      return {
        id: entry.id,
        label: entry.label,
        group: entry.group,
        kind: entry.kind,
        hint: entry.hint,
        configured: Boolean(String(effective).trim()),
        source: hasVault ? "vault" : fallback ? "environment" : "unset",
        masked: entry.kind === "secret" ? maskValue(effective) : null,
        value: entry.kind === "text" && effective ? effective : null,
      };
    });
  }

  /**
   * Persist a partial map of `id -> value`.
   * - Non-empty string: store as a vault override.
   * - Empty string: clear the override (environment/default takes over).
   * Unknown ids are rejected before anything is written.
   */
  async update(values) {
    const unknown = Object.keys(values).filter((id) => !byId.has(id));
    if (unknown.length) {
      const error = new Error(
        `Unknown configuration keys: ${unknown.join(", ")}`,
      );
      error.status = 400;
      throw error;
    }
    const touched = [];
    for (const [id, raw] of Object.entries(values)) {
      if (typeof raw !== "string") {
        const error = new Error(`Value for ${id} must be a string`);
        error.status = 400;
        throw error;
      }
      const value = raw.trim();
      if (value.length > MAX_VALUE_LENGTH) {
        const error = new Error(`${id} exceeds ${MAX_VALUE_LENGTH} characters`);
        error.status = 400;
        throw error;
      }
      if (value === "") {
        if (this.stored[id] !== undefined) delete this.stored[id];
      } else {
        this.stored[id] = value;
      }
      touched.push(id);
    }
    if (touched.length) {
      await this.store.saveSettings?.(this.stored);
      this.apply();
    }
    return { view: this.view(), touched };
  }
}
