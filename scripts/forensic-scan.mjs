#!/usr/bin/env node

/**
 * Safe production smoke scan. It exercises only WORLDGPZ's public read routes
 * (plus the optional on-demand AI brief), never accepts or prints credentials,
 * and emits a provider-by-provider readiness table.
 */
const rawBase =
  process.argv.find((arg) => /^https?:\/\//.test(arg)) ||
  process.env.WORLDGPZ_URL ||
  "https://worldgpz.onrender.com";
const base = rawBase.replace(/\/$/, "");
const includeAi = process.argv.includes("--include-ai");
const timeoutMs = 45_000;

const routes = [
  ["health", "/api/health"],
  ["dashboard", "/api/v1/dashboard"],
  ["sources", "/api/v1/sources"],
  ["news", "/api/v1/news"],
  ["youtube", "/api/v1/media/channels"],
  ["webcams", "/api/v1/webcams"],
  ["weather", "/api/v1/weather"],
  ["markets", "/api/v1/markets"],
  ["fires", "/api/v1/fires"],
  ["conflicts", "/api/v1/conflicts"],
  ["ships", "/api/v1/ships"],
  ["flights", "/api/v1/flights"],
  ["outages", "/api/v1/outages"],
  ["energy", "/api/v1/energy"],
  ["macro", "/api/v1/macro"],
];
if (includeAi) routes.push(["ai", "/api/v1/intelligence/brief", "POST"]);

async function probe([name, path, method = "GET"]) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.json().catch(() => null);
    const data = path === "/api/health" ? body : body?.data;
    return {
      name,
      path,
      http: response.status,
      ok: response.ok && Boolean(body),
      status: data?.status || (response.ok ? "ok" : "failed"),
      errorCode: data?.errorCode || body?.errorCode || "",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name,
      path,
      http: 0,
      ok: false,
      status: error?.name === "TimeoutError" ? "timeout" : "unreachable",
      errorCode: "network-error",
      latencyMs: Date.now() - startedAt,
    };
  }
}

console.log(`WORLDGPZ safe forensic scan: ${base}`);
console.log(`Started: ${new Date().toISOString()}\n`);
const results = await Promise.all(routes.map(probe));
console.table(
  results.map(({ name, http, status, errorCode, latencyMs }) => ({
    route: name,
    http,
    status,
    errorCode,
    latencyMs,
  })),
);

let providers = [];
try {
  const response = await fetch(`${base}/api/v1/providers`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.json();
  providers = body?.data || [];
} catch {
  // The route table already reports transport failures. Keep the final report stable.
}

if (providers.length) {
  console.log("\nProvider readiness (public-safe diagnostics):");
  console.table(
    providers.map((provider) => ({
      provider: provider.name,
      configured: provider.configured ? "yes" : "no",
      status: provider.status,
      errorCode: provider.errorCode || "",
      checkedAt: provider.checkedAt || "not checked",
    })),
  );
}

const transportFailures = results.filter((item) => !item.ok);
const degraded = providers.filter((item) => item.status === "degraded");
const unconfigured = providers.filter(
  (item) => item.status === "not-configured",
);
console.log(
  `\nSummary: ${results.length - transportFailures.length}/${results.length} routes reachable; ` +
    `${providers.length - degraded.length - unconfigured.length}/${providers.length || 0} providers ready/pending; ` +
    `${degraded.length} degraded; ${unconfigured.length} not configured.`,
);

if (transportFailures.length) process.exitCode = 1;
else if (degraded.length || unconfigured.length) process.exitCode = 2;
