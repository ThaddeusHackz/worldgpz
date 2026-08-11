import { ProviderBase } from "./base.js";

/**
 * Cloudflare Radar — verified Internet outage annotations and automatically
 * detected traffic anomalies grouped by country.
 */
export class CloudflareService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "Cloudflare Radar",
      group: "Outages",
      cacheSeconds: 600,
      ...options,
    });
  }

  get configured() {
    return Boolean(this.config.cloudflareApiToken);
  }

  async #get(path, parameters = {}) {
    const url = new URL(`https://api.cloudflare.com/client/v4/radar/${path}`);
    for (const [key, value] of Object.entries(parameters)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
    const payload = await this.fetchJson(url, {
      headers: {
        Authorization: `Bearer ${this.config.cloudflareApiToken}`,
      },
    });
    if (payload.success === false) {
      const error = new Error("Cloudflare Radar rejected the request");
      error.code = "provider-error";
      throw error;
    }
    return payload.result || {};
  }

  async #outages() {
    const result = await this.#get("annotations/outages/locations", {
      dateRange: "7d",
      limit: 20,
    });
    // The current v4 contract returns result.annotations, not locations.
    return (result.annotations || result.locations || []).map((entry) => ({
      location:
        entry.clientCountryName ||
        entry.locationName ||
        entry.locationCode ||
        "Unknown",
      code: entry.clientCountryAlpha2 || entry.locationCode || null,
      kind: "outage",
      count: Number(
        entry.value ??
          entry.outages?.outageCount ??
          entry.outages?.outageCountTotal ??
          entry.outageCount ??
          0,
      ),
      asnCount: Array.isArray(entry.outages?.asns)
        ? entry.outages.asns.length
        : 0,
    }));
  }

  async #anomalies() {
    const result = await this.#get("traffic_anomalies/locations", {
      dateRange: "7d",
      status: "VERIFIED",
      limit: 20,
    });
    // The current v4 contract returns result.trafficAnomalies.
    return (result.trafficAnomalies || result.locations || []).map((entry) => ({
      location:
        entry.clientCountryName ||
        entry.locationName ||
        entry.locationCode ||
        "Unknown",
      code: entry.clientCountryAlpha2 || entry.locationCode || null,
      kind: "anomaly",
      count: Number(
        entry.value ??
          entry.anomalies?.anomalyCount ??
          entry.anomalies?.anomalyCountTotal ??
          entry.anomalyCount ??
          0,
      ),
      asnCount: Array.isArray(entry.anomalies?.asns)
        ? entry.anomalies.asns.length
        : 0,
    }));
  }

  async collect() {
    const [outages, anomalies] = await Promise.allSettled([
      this.#outages(),
      this.#anomalies(),
    ]);
    if (outages.status === "rejected" && anomalies.status === "rejected")
      throw outages.reason;

    const outageItems = outages.status === "fulfilled" ? outages.value : [];
    const anomalyItems =
      anomalies.status === "fulfilled" ? anomalies.value : [];
    return {
      items: [...outageItems, ...anomalyItems].slice(0, 40),
      outages: outageItems.length,
      anomalies: anomalyItems.length,
      window: "last 7 days",
      degradedParts: [
        outages.status === "rejected" ? "outages" : null,
        anomalies.status === "rejected" ? "anomalies" : null,
      ].filter(Boolean),
    };
  }
}
