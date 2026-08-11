import { ProviderBase } from "./base.js";

/**
 * NASA FIRMS — satellite fire and thermal-anomaly detections.
 * Docs: https://firms.modaps.eosdis.nasa.gov/api/area
 * The MAP key is passed as a URL path segment; responses are CSV.
 */
const MAX_DETECTIONS = 250;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (field.length || row.length) row.push(field);
      if (row.length) rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += char;
    }
  }
  if (field.length || row.length) row.push(field);
  if (row.length) rows.push(row);
  return rows;
}

const SEVERITY_BY_FRP = (frp) =>
  frp >= 500 ? "critical" : frp >= 100 ? "high" : "medium";

export class FirmsService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "NASA FIRMS",
      group: "Fires",
      cacheSeconds: config.firms?.cacheSeconds ?? 3600,
      ...options,
    });
  }

  get configured() {
    return Boolean(this.config.firmsApiKey);
  }

  async #source(source) {
    const url =
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/` +
      `${encodeURIComponent(this.config.firmsApiKey)}/${source}/` +
      `${encodeURIComponent(this.config.firms.area)}/1`;
    const text = await this.fetchText(url, {
      headers: { Accept: "text/csv" },
      timeoutMs: Math.max(this.timeoutMs, 20_000),
    });
    const rows = parseCsv(text);
    if (!rows.length) return [];
    const [header, ...body] = rows;
    const columns = header.map((name) => name.trim().toLowerCase());
    // FIRMS sometimes returns a 200 text response for a rejected MAP key or
    // exhausted transaction budget. Never misreport that as "no fires".
    if (!columns.includes("latitude") || !columns.includes("longitude")) {
      const diagnostic = text.toLowerCase();
      const error = new Error("FIRMS returned a non-CSV diagnostic response");
      error.code = /map.?key|unauthor|invalid key/.test(diagnostic)
        ? "credential-rejected"
        : /transaction|quota|rate.?limit/.test(diagnostic)
          ? "quota-exceeded"
          : "invalid-response";
      throw error;
    }
    const pick = (row, name) => {
      const position = columns.indexOf(name);
      return position >= 0 ? row[position] : undefined;
    };
    return body
      .filter((row) => row.length >= columns.length)
      .map((row, index) => {
        const latitude = Number(pick(row, "latitude"));
        const longitude = Number(pick(row, "longitude"));
        const frp = Number(pick(row, "frp") || 0);
        const confidence = pick(row, "confidence");
        const daynight = pick(row, "daynight");
        const acqDate = pick(row, "acq_date");
        const acqTime = String(pick(row, "acq_time") || "").padStart(4, "0");
        const hour = acqTime.slice(0, 2);
        const minute = acqTime.slice(2, 4);
        return {
          id: `firms-${source}-${index}-${acqDate}-${acqTime}`,
          title: `${source.replace("_NRT", "")} fire detection`,
          summary:
            `Thermal anomaly with radiative power ${frp.toFixed(0)} MW · ` +
            `confidence ${confidence || "—"} · ${daynight || "day/night"} acquisition.`,
          category: "natural",
          severity: SEVERITY_BY_FRP(frp),
          status: "monitoring",
          region: "Global",
          country: "Satellite detection",
          latitude,
          longitude,
          frp,
          confidence,
          daynight,
          satellite: pick(row, "satellite"),
          instrument: pick(row, "instrument"),
          sourceName: "NASA FIRMS",
          sourceUrl: "https://firms.modaps.eosdis.nasa.gov/map/",
          publishedAt: `${acqDate}T${hour}:${minute}:00Z`,
          live: true,
        };
      })
      .filter(
        (event) =>
          Number.isFinite(event.latitude) && Number.isFinite(event.longitude),
      );
  }

  async collect() {
    const configuredSources = [
      ...new Set(this.config.firms.sources || ["VIIRS_SNPP_NRT"]),
    ];
    const settled = await Promise.allSettled(
      configuredSources.map((source) => this.#source(source)),
    );
    const detections = [];
    const errors = [];
    for (const result of settled) {
      if (result.status === "fulfilled") detections.push(...result.value);
      else errors.push(result.reason);
    }

    // A valid global request should almost always contain detections. If all
    // selected satellites legitimately return an empty CSV, try NOAA-20 once;
    // this also covers short source-specific acquisition gaps.
    const fallbackSource = "VIIRS_NOAA20_NRT";
    if (
      !detections.length &&
      !errors.length &&
      !configuredSources.includes(fallbackSource)
    ) {
      detections.push(...(await this.#source(fallbackSource)));
      configuredSources.push(fallbackSource);
    }
    if (!detections.length && errors.length) throw errors[0];
    if (!detections.length) {
      const error = new Error(
        "FIRMS returned no detections in the selected window",
      );
      error.code = "no-data";
      throw error;
    }
    const ranked = detections
      .sort((a, b) => (b.frp || 0) - (a.frp || 0))
      .slice(0, MAX_DETECTIONS);
    return {
      events: ranked,
      detections: ranked.length,
      window: "last 24 hours",
      sources: configuredSources,
    };
  }
}
