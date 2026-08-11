import { ProviderBase, errorCodeFor } from "./base.js";

/**
 * OpenSky Network live aircraft positions using OAuth2 client credentials.
 * OpenSky's states endpoint can be slow for continent-scale boxes, so this
 * adapter uses a 20-second provider timeout and a bounded regional retry.
 */
const MAX_AIRCRAFT = 300;
const REGIONAL_FALLBACK_BBOX = [35, -10, 60, 30];

const STATES_INDEX = {
  icao24: 0,
  callsign: 1,
  originCountry: 2,
  timePosition: 3,
  lastContact: 4,
  longitude: 5,
  latitude: 6,
  baroAltitude: 7,
  onGround: 8,
  velocity: 9,
  trueTrack: 10,
  verticalRate: 11,
  sensors: 12,
  geoAltitude: 13,
  squawk: 14,
  spi: 15,
  positionSource: 16,
  category: 17,
};

const validBbox = (bbox) =>
  Array.isArray(bbox) &&
  bbox.length === 4 &&
  bbox.every(Number.isFinite) &&
  bbox[0] >= -90 &&
  bbox[2] <= 90 &&
  bbox[1] >= -180 &&
  bbox[3] <= 180 &&
  bbox[0] < bbox[2] &&
  bbox[1] < bbox[3];

export class OpenSkyService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "OpenSky",
      group: "Flights",
      cacheSeconds: 60,
      timeoutMs: config.openSky?.timeoutMs || 20_000,
      ...options,
    });
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  get configured() {
    return Boolean(
      this.config.openSky?.clientId && this.config.openSky?.clientSecret,
    );
  }

  async #accessToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    const payload = await this.fetchForm(
      "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
      {
        grant_type: "client_credentials",
        client_id: this.config.openSky.clientId,
        client_secret: this.config.openSky.clientSecret,
      },
    );
    if (!payload.access_token) {
      const error = new Error(
        "OpenSky token exchange returned no access token",
      );
      error.code = "credential-rejected";
      throw error;
    }
    const expiresIn = Number(payload.expires_in) || 1800;
    this.token = payload.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(60, expiresIn - 60) * 1000;
    return this.token;
  }

  async #states(token, bbox) {
    const [lamin, lomin, lamax, lomax] = bbox;
    const url = new URL("https://opensky-network.org/api/states/all");
    url.searchParams.set("lamin", String(lamin));
    url.searchParams.set("lomin", String(lomin));
    url.searchParams.set("lamax", String(lamax));
    url.searchParams.set("lomax", String(lomax));
    return this.fetchJson(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async collect() {
    const requestedBbox = validBbox(this.config.openSky.bbox)
      ? this.config.openSky.bbox
      : REGIONAL_FALLBACK_BBOX;
    const token = await this.#accessToken();
    let effectiveBbox = requestedBbox;
    let coverage = "configured bounding box";
    let payload;
    try {
      payload = await this.#states(token, requestedBbox);
    } catch (error) {
      const area =
        (requestedBbox[2] - requestedBbox[0]) *
        (requestedBbox[3] - requestedBbox[1]);
      if (errorCodeFor(error) !== "timeout" || area < 2_000) throw error;
      // Preserve live functionality when a very large OpenSky query times out.
      // The response explicitly labels the narrower coverage.
      effectiveBbox = REGIONAL_FALLBACK_BBOX;
      coverage = "regional fallback after large-window timeout";
      payload = await this.#states(token, effectiveBbox);
    }
    const states = payload.states || [];
    if (!states.length) {
      const error = new Error("OpenSky returned no aircraft states");
      error.code = "no-data";
      throw error;
    }

    const inAir = states
      .filter((row) => !row[STATES_INDEX.onGround])
      .slice(0, MAX_AIRCRAFT)
      .map((row) => ({
        icao24: row[STATES_INDEX.icao24] || null,
        callsign: (row[STATES_INDEX.callsign] || "").trim() || "Unknown",
        originCountry: row[STATES_INDEX.originCountry] || "Unknown",
        latitude: row[STATES_INDEX.latitude],
        longitude: row[STATES_INDEX.longitude],
        altitudeM:
          row[STATES_INDEX.baroAltitude] ??
          row[STATES_INDEX.geoAltitude] ??
          null,
        velocityMs: row[STATES_INDEX.velocity] ?? null,
        trueTrack: row[STATES_INDEX.trueTrack] ?? null,
        verticalRate: row[STATES_INDEX.verticalRate] ?? null,
        squawk: row[STATES_INDEX.squawk] || null,
        lastContact: row[STATES_INDEX.lastContact]
          ? new Date(row[STATES_INDEX.lastContact] * 1000).toISOString()
          : null,
      }))
      .filter(
        (aircraft) =>
          Number.isFinite(aircraft.latitude) &&
          Number.isFinite(aircraft.longitude),
      );

    return {
      aircraft: inAir,
      total: inAir.length,
      window: "current snapshot",
      bbox: effectiveBbox,
      requestedBbox,
      coverage,
    };
  }
}
