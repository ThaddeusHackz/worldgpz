import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
dotenv.config({ path: path.join(root, ".env"), quiet: true });
dotenv.config({
  path: path.join(root, "server/.env"),
  override: true,
  quiet: true,
});

const numberFromEnv = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const config = {
  root,
  env: process.env.NODE_ENV || "development",
  port: numberFromEnv(process.env.PORT, 4000),
  appUrl:
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:4000",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: numberFromEnv(process.env.TRUST_PROXY, 0),
  jwtSecret:
    process.env.JWT_SECRET ||
    "development-only-secret-change-before-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  // Single, fixed operator credential pair for the command console.
  admin: {
    name: process.env.ADMIN_NAME || "GOD'S EYE Operator",
    username: "admin",
    email: "admin@worldgpz.local",
    password: "admin12345",
  },
  mongodbUri: process.env.MONGODB_URI || "",
  mongodbDb: process.env.MONGODB_DB || "worldgpz",
  localDataFile:
    process.env.LOCAL_DATA_FILE || path.join(root, "server/data/worldgpz.json"),
  /**
   * Encrypted vault blob. When set, it seeds admin-pasted API keys at boot so
   * they survive redeploys and machine changes on ephemeral filesystems.
   * Export it from the admin console → Secure Uplink → Export vault.
   */
  vaultBlob: (process.env.WORLDGPZ_VAULT || "").trim(),
  /**
   * Secret used to encrypt/decrypt the vault blob. Defaults to JWT_SECRET so
   * a deployment works with no extra configuration; set WORLDGPZ_VAULT_SECRET
   * to rotate vault transport independently of sessions.
   */
  vaultSecret:
    process.env.WORLDGPZ_VAULT_SECRET ||
    process.env.JWT_SECRET ||
    "development-only-secret-change-before-production",
  sourceCacheSeconds: numberFromEnv(process.env.SOURCE_CACHE_SECONDS, 300),
  fetchTimeoutMs: numberFromEnv(process.env.FETCH_TIMEOUT_MS, 8000),
  newsApiKey: process.env.NEWS_API_KEY || "",
  youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
  youtubeCacheSeconds: numberFromEnv(process.env.YOUTUBE_CACHE_SECONDS, 10_800),
  weatherApiKey: process.env.OPENWEATHER_API_KEY || "",
  ai: {
    apiKey: process.env.AI_API_KEY || "",
    baseUrl: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    ),
    model: process.env.AI_MODEL || "gpt-4o-mini",
  },
  // Extended provider credentials. All keys stay server-side.
  windyApiKey: process.env.WINDY_API_KEY || "",
  finnhubApiKey: process.env.FINNHUB_API_KEY || "",
  firmsApiKey: process.env.NASA_FIRMS_API_KEY || "",
  firms: {
    sources: (process.env.FIRMS_SOURCES || "VIIRS_SNPP_NRT,MODIS_NRT")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    area: process.env.FIRMS_AREA || "world",
    cacheSeconds: numberFromEnv(process.env.FIRMS_CACHE_SECONDS, 3600),
  },
  acled: {
    accessToken: process.env.ACLED_ACCESS_TOKEN || "",
    email: process.env.ACLED_EMAIL || "",
    password: process.env.ACLED_PASSWORD || "",
  },
  aisStreamApiKey: process.env.AISSTREAM_API_KEY || "",
  openSky: {
    clientId: process.env.OPENSKY_CLIENT_ID || "",
    clientSecret: process.env.OPENSKY_CLIENT_SECRET || "",
    bbox: (process.env.OPENSKY_BBOX || "-10,-30,70,60")
      .split(",")
      .map((item) => Number(item))
      .filter(Number.isFinite),
    timeoutMs: numberFromEnv(process.env.OPENSKY_TIMEOUT_MS, 20_000),
  },
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || "",
  eiaApiKey: process.env.EIA_API_KEY || "",
  fredApiKey: process.env.FRED_API_KEY || "",
};

export function validateProductionConfig() {
  if (config.env !== "production") return;

  const failures = [];
  if (
    config.jwtSecret.length < 32 ||
    config.jwtSecret.includes("development-only")
  ) {
    failures.push(
      "JWT_SECRET must be a unique random value of at least 32 characters",
    );
  }
  if (
    config.admin.username !== "admin" ||
    config.admin.password !== "admin12345"
  ) {
    // The fixed operator pair is baked in; this guard documents intent and
    // fails loudly if a future change silently breaks the console login.
    failures.push("Administrator credentials must remain admin / admin12345");
  }

  if (failures.length) {
    throw new Error(
      `Invalid production configuration:\n- ${failures.join("\n- ")}`,
    );
  }
}
