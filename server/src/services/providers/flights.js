import { ProviderBase } from "./base.js";

/**
 * OpenSky Network — live aircraft positions.
 * Docs: https://openskynetwork.github.io/opensky-api/rest.html
 *
 * Auth (OAuth2 client-credentials, required for accounts created after
 * March 2025): exchange OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET at the
 * OpenID Connect token endpoint, then send the access token as a Bearer
 * header on every request. Tokens are cached until shortly before expiry.
 */
const MAX_AIRCRAFT = 300;

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

export class OpenSkyService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "OpenSky",
      group: "Flights",
      cacheSeconds: 60,
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
    if (!payload.access_token)
      throw new Error("OpenSky token exchange returned no access token");
    const expiresIn = Number(payload.expires_in) || 1800;
    this.token = payload.access_token;
    this.tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
    return this.token;
  }

  async collect() {
    const token = await this.#accessToken();
    const [lamin, lomin, lamax, lomax] = this.config.openSky.bbox;
    const url = new URL("https://opensky-network.org/api/states/all");
    url.searchParams.set("lamin", String(lamin));
    url.searchParams.set("lomin", String(lomin));
    url.searchParams.set("lamax", String(lamax));
    url.searchParams.set("lomax", String(lomax));
    const payload = await this.fetchJson(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const states = payload.states || [];
    if (!states.length) throw new Error("OpenSky returned no aircraft states");

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
      bbox: [lamin, lomin, lamax, lomax],
    };
  }
}
