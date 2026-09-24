import { parseTleFile } from "./parsers.js";

/**
 * TrackService — real two-line-element (TLE) catalogues from CelesTrak,
 * the public space-data archive. The client propagates these orbits with
 * SGP4 (satellite.js), producing genuine satellite positions, altitudes,
 * and velocities. Cached for six hours; degrades to an empty catalogue.
 */
const TLE_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle";

export class TrackService {
  constructor(config) {
    this.config = config;
    this.cache = null;
    this.cachedAt = 0;
    this.lastError = null;
  }

  async list({ fresh = false } = {}) {
    const maxAge = 6 * 60 * 60 * 1000;
    if (!fresh && this.cache && Date.now() - this.cachedAt < maxAge)
      return this.cache;

    try {
      const response = await fetch(TLE_URL, {
        signal: AbortSignal.timeout(this.config.fetchTimeoutMs || 8000),
        headers: { "User-Agent": "WORLDGPZ/3.2 (public orbital tracking)" },
      });
      if (!response.ok)
        throw new Error(`CelesTrak returned ${response.status}`);
      const text = await response.text();
      const satellites = parseTleFile(text);
      if (!satellites.length) throw new Error("CelesTrak catalogue was empty");
      this.cache = {
        group: "visual",
        satellites,
        status: "operational",
        fetchedAt: new Date().toISOString(),
      };
      this.lastError = null;
    } catch (error) {
      this.lastError = error?.message || "CelesTrak unavailable";
      this.cache = {
        group: "visual",
        satellites: this.cache?.satellites || [],
        status: this.cache?.satellites?.length ? "cached" : "degraded",
        error: this.lastError,
        fetchedAt: this.cache?.fetchedAt || null,
      };
    }
    this.cachedAt = Date.now();
    return this.cache;
  }
}
