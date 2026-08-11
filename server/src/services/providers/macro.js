import { ProviderBase } from "./base.js";

/**
 * FRED (Federal Reserve Economic Data) — interest rates, inflation, and
 * macroeconomic indicators.
 * Docs: https://fred.stlouisfed.org/docs/api/fred/
 * Auth: `api_key` query parameter.
 */
const SERIES = [
  { id: "DFF", name: "Federal Funds Rate", unit: "percent" },
  { id: "DGS10", name: "10-Year Treasury Yield", unit: "percent" },
  { id: "DGS2", name: "2-Year Treasury Yield", unit: "percent" },
  { id: "CPIAUCSL", name: "CPI (All Urban Consumers)", unit: "index" },
  { id: "UNRATE", name: "Unemployment Rate", unit: "percent" },
  { id: "VIXCLS", name: "CBOE Volatility Index (VIX)", unit: "index" },
];

export class FredService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "FRED",
      group: "Macro",
      cacheSeconds: 3600,
      ...options,
    });
  }

  get configured() {
    return Boolean(this.config.fredApiKey);
  }

  async #series(definition) {
    const url = new URL("https://api.stlouisfed.org/fred/series/observations");
    url.searchParams.set("series_id", definition.id);
    url.searchParams.set("api_key", this.config.fredApiKey);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("sort_order", "desc");
    url.searchParams.set("limit", "2");
    const payload = await this.fetchJson(url);
    const rows = payload.observations || [];
    const latest = rows[0];
    const previous = rows[1];
    return {
      id: definition.id,
      name: definition.name,
      unit: definition.unit,
      date: latest?.date || null,
      value: latest?.value != null ? Number(latest.value) : null,
      previousValue: previous?.value != null ? Number(previous.value) : null,
    };
  }

  async collect() {
    const settled = await Promise.allSettled(
      SERIES.map((definition) => this.#series(definition)),
    );
    const series = [];
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value.value != null)
        series.push(result.value);
    }
    if (!series.length) throw new Error("FRED returned no observations");
    return { series, total: series.length };
  }
}
