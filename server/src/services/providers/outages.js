import { ProviderBase } from "./base.js";

/**
 * Cloudflare Radar — internet outages and traffic anomalies by location.
 * Docs: https://developers.cloudflare.com/radar/
 * Auth: `Authorization: Bearer <API token>`.
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
    if (payload.success === false)
      throw new Error(`Cloudflare Radar rejected the request`);
    return payload.result || {};
  }

  async #outages() {
    const result = await this.#get("annotations/outages/locations", {
      limit: 20,
    });
    return (result.locations || []).map((entry) => ({
      location: entry.locationName || entry.locationCode || "Unknown",
      code: entry.locationCode || null,
      kind: "outage",
      count:
        entry.outages?.outageCount ??
        entry.outages?.outageCountTotal ??
        entry.outageCount ??
        1,
      asnCount: Array.isArray(entry.outages?.asns)
        ? entry.outages.asns.length
        : 0,
    }));
  }

  async #anomalies() {
    const result = await this.#get("traffic_anomalies/locations", {
      dateRange: "1d",
      limit: 20,
    });
    return (result.locations || []).map((entry) => ({
      location: entry.locationName || entry.locationCode || "Unknown",
      code: entry.locationCode || null,
      kind: "anomaly",
      count:
        entry.anomalies?.anomalyCount ??
        entry.anomalies?.anomalyCountTotal ??
        entry.anomalyCount ??
        1,
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
    const items = [];
    if (outages.status === "fulfilled") items.push(...outages.value);
    if (anomalies.status === "fulfilled") items.push(...anomalies.value);
    if (!items.length) {
      const firstError =
        outages.status === "rejected"
          ? outages.reason
          : anomalies.status === "rejected"
            ? anomalies.reason
            : null;
      throw firstError || new Error("Cloudflare Radar returned no locations");
    }
    return {
      items: items.slice(0, 40),
      outages: outages.status === "fulfilled" ? outages.value.length : 0,
      anomalies: anomalies.status === "fulfilled" ? anomalies.value.length : 0,
      degradedParts: [
        outages.status === "rejected" ? "outages" : null,
        anomalies.status === "rejected" ? "anomalies" : null,
      ].filter(Boolean),
    };
  }
}
