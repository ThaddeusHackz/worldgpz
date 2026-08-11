import { ProviderBase } from "./base.js";

/**
 * ACLED — armed conflict, protest, and political-violence events.
 * Docs: https://acleddata.com/api-documentation/getting-started
 *
 * Two credential modes are supported:
 * - `ACLED_ACCESS_TOKEN` — a pre-issued bearer token (used directly), or
 * - `ACLED_EMAIL` + `ACLED_PASSWORD` — exchanged for a 24-hour bearer token
 *   via the OAuth2 password grant at https://acleddata.com/oauth/token.
 */
const REGION_BY_COUNTRY = {
  Ukraine: "Europe",
  Russia: "Europe",
  Belarus: "Europe",
  Poland: "Europe",
  Sudan: "Africa",
  Ethiopia: "Africa",
  Somalia: "Africa",
  Nigeria: "Africa",
  "Democratic Republic of Congo": "Africa",
  "DR Congo": "Africa",
  Mali: "Africa",
  Niger: "Africa",
  "Burkina Faso": "Africa",
  Libya: "Africa",
  Egypt: "Africa",
  Kenya: "Africa",
  Mozambique: "Africa",
  Chad: "Africa",
  Cameroon: "Africa",
  "Central African Republic": "Africa",
  Palestine: "Middle East",
  Israel: "Middle East",
  Yemen: "Middle East",
  Syria: "Middle East",
  Iraq: "Middle East",
  Iran: "Middle East",
  Turkey: "Middle East",
  Lebanon: "Middle East",
  Jordan: "Middle East",
  Afghanistan: "Asia",
  Pakistan: "Asia",
  Myanmar: "Asia",
  India: "Asia",
  Bangladesh: "Asia",
  "Sri Lanka": "Asia",
  Nepal: "Asia",
  Philippines: "Asia Pacific",
  Indonesia: "Asia Pacific",
  "Papua New Guinea": "Asia Pacific",
  Thailand: "Asia Pacific",
  Colombia: "Americas",
  Mexico: "Americas",
  Haiti: "Americas",
  Venezuela: "Americas",
  Brazil: "Americas",
  "United States": "Americas",
  Ecuador: "Americas",
  Peru: "Americas",
  "El Salvador": "Americas",
  Honduras: "Americas",
  Guatemala: "Americas",
};

const CATEGORY_BY_EVENT_TYPE = {
  Battles: "conflict",
  "Explosions/Remote violence": "conflict",
  "Violence against civilians": "conflict",
  Riots: "conflict",
  Protests: "diplomacy",
  "Strategic developments": "diplomacy",
};

export class AcledService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "ACLED",
      group: "Conflict",
      cacheSeconds: 900,
      ...options,
    });
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  get configured() {
    return Boolean(
      this.config.acled?.accessToken ||
      (this.config.acled?.email && this.config.acled?.password),
    );
  }

  async #accessToken() {
    if (this.config.acled.accessToken) return this.config.acled.accessToken;
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;

    const payload = await this.fetchForm("https://acleddata.com/oauth/token", {
      username: this.config.acled.email,
      password: this.config.acled.password,
      grant_type: "password",
      client_id: "acled",
      scope: "authenticated",
    });
    if (!payload.access_token)
      throw new Error("ACLED token exchange returned no access token");
    const expiresIn = Number(payload.expires_in) || 86_400;
    this.token = payload.access_token;
    this.tokenExpiresAt = Date.now() + (expiresIn - 300) * 1000;
    return this.token;
  }

  async collect() {
    const token = await this.#accessToken();
    const url = new URL("https://acleddata.com/api/acled/read");
    url.searchParams.set("_format", "json");
    url.searchParams.set("limit", "50");
    url.searchParams.set(
      "fields",
      [
        "event_id_cnty",
        "event_date",
        "event_type",
        "sub_event_type",
        "country",
        "admin1",
        "location",
        "latitude",
        "longitude",
        "fatalities",
        "notes",
      ].join("|"),
    );
    const payload = await this.fetchJson(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rows = payload.data || payload.results || payload.items || [];
    if (!rows.length) throw new Error("ACLED returned no events");

    const events = rows.slice(0, 50).map((item) => {
      const eventType = item.event_type || "Unknown";
      const country = item.country || "Unknown";
      const fatalities = Number(item.fatalities) || 0;
      const category = CATEGORY_BY_EVENT_TYPE[eventType] || "conflict";
      return {
        id: `acled-${item.event_id_cnty || `${country}-${item.event_date}-${rows.indexOf(item)}`}`,
        title: `${eventType} in ${item.location || country}`,
        summary:
          (item.notes ? `${item.notes.slice(0, 220)} ` : "") +
          `${fatalities} reported fatality${fatalities === 1 ? "" : "ies"}.`,
        category,
        severity:
          fatalities >= 10 ? "critical" : fatalities >= 1 ? "high" : "medium",
        status: "monitoring",
        region: REGION_BY_COUNTRY[country] || "Global",
        country,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        eventType,
        subEventType: item.sub_event_type || null,
        fatalities,
        sourceName: "ACLED",
        sourceUrl: "https://acleddata.com/dashboard/#/dashboard",
        publishedAt: item.event_date
          ? `${item.event_date}T00:00:00Z`
          : new Date().toISOString(),
        live: true,
      };
    });
    return { events, total: events.length };
  }
}
