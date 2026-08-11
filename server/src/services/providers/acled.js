import { ProviderBase } from "./base.js";

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

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
      timeoutMs: Math.max(config.fetchTimeoutMs || 8_000, 15_000),
      ...options,
    });
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiresAt = 0;
  }

  get configured() {
    return Boolean(
      this.config.acled?.accessToken ||
      (this.config.acled?.email && this.config.acled?.password),
    );
  }

  get hasAccountCredentials() {
    return Boolean(this.config.acled?.email && this.config.acled?.password);
  }

  async #exchangeCredentials() {
    // client_id=acled supplies the authenticated scope by default. Omitting an
    // explicit scope matches ACLED's maintained clients and avoids a 401 from
    // deployments that reject the formerly documented scope parameter.
    const payload = await this.fetchForm(
      "https://acleddata.com/oauth/token",
      {
        username: this.config.acled.email,
        password: this.config.acled.password,
        grant_type: "password",
        client_id: "acled",
      },
      { headers: { "User-Agent": CHROME_USER_AGENT } },
    );
    if (!payload.access_token) {
      const error = new Error("ACLED token exchange returned no access token");
      error.code = "credential-rejected";
      throw error;
    }
    const expiresIn = Number(payload.expires_in) || 86_400;
    this.token = payload.access_token;
    this.refreshToken = payload.refresh_token || null;
    this.tokenExpiresAt = Date.now() + Math.max(60, expiresIn - 300) * 1000;
    return this.token;
  }

  async #accessToken({ force = false } = {}) {
    if (!force && this.token && Date.now() < this.tokenExpiresAt)
      return this.token;
    if (this.hasAccountCredentials) return this.#exchangeCredentials();
    if (this.config.acled.accessToken) return this.config.acled.accessToken;
    const error = new Error("ACLED credentials are unavailable");
    error.code = "credential-rejected";
    throw error;
  }

  async #fetchRows(token) {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateOnly = (date) => date.toISOString().slice(0, 10);
    const url = new URL("https://acleddata.com/api/acled/read");
    url.searchParams.set("_format", "json");
    url.searchParams.set("limit", "100");
    url.searchParams.set("event_date", `${dateOnly(start)}|${dateOnly(now)}`);
    url.searchParams.set("event_date_where", "BETWEEN");
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
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": CHROME_USER_AGENT,
      },
    });
    if (payload.message || payload.error) {
      const error = new Error("ACLED rejected the data request");
      error.code = "provider-error";
      throw error;
    }
    return payload.data || payload.results || payload.items || [];
  }

  async collect() {
    let token = await this.#accessToken();
    let rows;
    try {
      rows = await this.#fetchRows(token);
    } catch (error) {
      // A cached 24-hour token may have expired server-side. Re-authenticate
      // exactly once when account credentials are available.
      if (error.code !== "credential-rejected" || !this.hasAccountCredentials)
        throw error;
      this.token = null;
      this.tokenExpiresAt = 0;
      token = await this.#accessToken({ force: true });
      rows = await this.#fetchRows(token);
    }
    if (!rows.length) {
      const error = new Error("ACLED returned no recent events");
      error.code = "no-data";
      throw error;
    }

    const events = rows.slice(0, 100).flatMap((item, index) => {
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      const eventType = item.event_type || "Unknown";
      const country = item.country || "Unknown";
      const fatalities = Number(item.fatalities) || 0;
      const category = CATEGORY_BY_EVENT_TYPE[eventType] || "conflict";
      return [
        {
          id: `acled-${item.event_id_cnty || `${country}-${item.event_date}-${index}`}`,
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
          latitude,
          longitude,
          eventType,
          subEventType: item.sub_event_type || null,
          fatalities,
          sourceName: "ACLED",
          sourceUrl: "https://acleddata.com/dashboard/#/dashboard",
          publishedAt: item.event_date
            ? `${item.event_date}T00:00:00Z`
            : new Date().toISOString(),
          live: true,
        },
      ];
    });
    if (!events.length) {
      const error = new Error("ACLED returned no mappable recent events");
      error.code = "no-data";
      throw error;
    }
    return { events, total: events.length, window: "last 30 days" };
  }
}
