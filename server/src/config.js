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
  appUrl: process.env.APP_URL || "http://localhost:4000",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: numberFromEnv(process.env.TRUST_PROXY, 0),
  jwtSecret:
    process.env.JWT_SECRET ||
    "development-only-secret-change-before-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  admin: {
    name: process.env.ADMIN_NAME || "WORLDGPZ Administrator",
    email: (process.env.ADMIN_EMAIL || "admin@worldgpz.local").toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "WorldGPZ!Local#2026",
  },
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: process.env.DATABASE_SSL === "true",
  localDataFile:
    process.env.LOCAL_DATA_FILE || path.join(root, "server/data/worldgpz.json"),
  sourceCacheSeconds: numberFromEnv(process.env.SOURCE_CACHE_SECONDS, 300),
  fetchTimeoutMs: numberFromEnv(process.env.FETCH_TIMEOUT_MS, 8000),
  newsApiKey: process.env.NEWS_API_KEY || "",
  weatherApiKey: process.env.OPENWEATHER_API_KEY || "",
  ai: {
    apiKey: process.env.AI_API_KEY || "",
    baseUrl: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    ),
    model: process.env.AI_MODEL || "gpt-4o-mini",
  },
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
    config.admin.password.length < 12 ||
    config.admin.password === "WorldGPZ!Local#2026"
  ) {
    failures.push(
      "ADMIN_PASSWORD must be a unique value of at least 12 characters",
    );
  }
  if (!config.admin.email.includes("@"))
    failures.push("ADMIN_EMAIL must be a valid email address");
  if (!config.databaseUrl)
    failures.push("DATABASE_URL is required in production");

  if (failures.length) {
    throw new Error(
      `Invalid production configuration:\n- ${failures.join("\n- ")}`,
    );
  }
}
