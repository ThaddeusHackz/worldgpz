import { ProviderBase } from "./base.js";

/**
 * U.S. Energy Information Administration (EIA) — oil, petroleum, and natural
 * gas prices. EIA v2 Open Data API.
 * Docs: https://www.eia.gov/opendata/
 * Auth: `api_key` query parameter.
 */
const SERIES = [
  {
    id: "WTI",
    name: "WTI Crude Oil (Cushing)",
    unit: "USD/barrel",
    frequency: "daily",
    path: "petroleum/pri/spt/data",
    facet: "RWTC",
  },
  {
    id: "Brent",
    name: "Brent Crude Oil (Europe)",
    unit: "USD/barrel",
    frequency: "daily",
    path: "petroleum/pri/spt/data",
    facet: "RBRTE",
  },
  {
    id: "HenryHub",
    name: "Natural Gas (Henry Hub)",
    unit: "USD/MMBtu",
    frequency: "daily",
    path: "natural-gas/pri/fut/data",
    facet: "RNGWHHD",
  },
];

export class EiaService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "EIA",
      group: "Energy",
      cacheSeconds: 1800,
      ...options,
    });
  }

  get configured() {
    return Boolean(this.config.eiaApiKey);
  }

  async #series(definition) {
    const url = new URL(`https://api.eia.gov/v2/${definition.path}/`);
    url.searchParams.set("api_key", this.config.eiaApiKey);
    url.searchParams.set("frequency", definition.frequency);
    url.searchParams.set("data[0]", "value");
    url.searchParams.set("facets[series][]", definition.facet);
    url.searchParams.set("sort[0][column]", "period");
    url.searchParams.set("sort[0][direction]", "desc");
    url.searchParams.set("length", "2");
    const payload = await this.fetchJson(url);
    const rows = payload.response?.data || [];
    const latest = rows[0];
    const previous = rows[1];
    return {
      id: definition.id,
      name: definition.name,
      unit: definition.unit,
      period: latest?.period || null,
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
    if (!series.length) throw new Error("EIA returned no series values");
    return { series, total: series.length };
  }
}
