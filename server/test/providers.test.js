import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WindyService } from "../src/services/providers/windy.js";
import { FinnhubService } from "../src/services/providers/markets.js";
import { FirmsService } from "../src/services/providers/firms.js";
import { AcledService } from "../src/services/providers/acled.js";
import { EiaService } from "../src/services/providers/energy.js";
import { FredService } from "../src/services/providers/macro.js";
import { CloudflareService } from "../src/services/providers/outages.js";
import { OpenSkyService } from "../src/services/providers/flights.js";
import { AisStreamService } from "../src/services/providers/ships.js";
import { ProviderRegistry } from "../src/services/providers/registry.js";

const baseConfig = {
  fetchTimeoutMs: 2_000,
  windyApiKey: "",
  finnhubApiKey: "",
  firmsApiKey: "",
  firms: { sources: ["VIIRS_SNPP_NRT"], area: "world", cacheSeconds: 60 },
  acled: { accessToken: "", email: "", password: "" },
  aisStreamApiKey: "",
  openSky: { clientId: "", clientSecret: "", bbox: [-10, -30, 70, 60] },
  cloudflareApiToken: "",
  eiaApiKey: "",
  fredApiKey: "",
  newsApiKey: "",
  youtubeApiKey: "",
  ai: { apiKey: "", baseUrl: "", model: "test-model" },
};

const configFor = (overrides = {}) => ({ ...baseConfig, ...overrides });

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

const textResponse = (text, status = 200) =>
  new Response(text, {
    status,
    headers: { "content-type": "text/csv" },
  });

/** Builds a fetch stub: routes are [{ test(url), handler(record) }]. */
function fakeFetch(routes, requests = []) {
  return async (input, options = {}) => {
    const url = new URL(input);
    const record = {
      url,
      method: options.method || "GET",
      headers: options.headers || {},
      body: String(options.body || ""),
    };
    requests.push(record);
    for (const route of routes) {
      if (route.test(url)) return route.handler(record);
    }
    return jsonResponse({ error: "unexpected request" }, 404);
  };
}

const csvFixture = [
  "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight",
  "-14.2,32.5,330.1,0.5,0.5,2026-08-10,2310,N,VIIRS,82,2.0,310.2,45.3,D",
  "10.5,45.2,360.0,0.4,0.4,2026-08-10,1420,N,VIIRS,95,2.0,340.0,620.0,D",
  "51.4,30.1,300.0,0.4,0.4,2026-08-10,0115,N,VIIRS,60,2.0,290.0,12.0,N",
].join("\n");

describe("WindyService (webcams)", () => {
  it("reports not-configured without network calls", async () => {
    const requests = [];
    const service = new WindyService(configFor(), {
      fetchFn: fakeFetch([], requests),
    });
    const result = await service.snapshot();
    expect(result.status).toBe("not-configured");
    expect(result.configured).toBe(false);
    expect(requests).toHaveLength(0);
  });

  it("calls the API with the key header, maps webcams, and caches", async () => {
    const requests = [];
    const fetchFn = fakeFetch(
      [
        {
          test: (url) => url.pathname.endsWith("/webcams"),
          handler: () =>
            jsonResponse({
              total: 1,
              webcams: [
                {
                  id: 1401795663,
                  status: "active",
                  title: "Kinshasa river cam",
                  location: {
                    latitude: -4.3,
                    longitude: 15.3,
                    city: "Kinshasa",
                    country: "CD",
                  },
                  images: {
                    current: {
                      thumbnail: "https://images.windy.com/thumb.jpg",
                      preview: "https://images.windy.com/preview.jpg",
                    },
                  },
                  player: {
                    embed: "https://webcams.windy.com/webcams/embed/1401795663",
                  },
                  properties: { is_streaming: true },
                },
              ],
            }),
        },
      ],
      requests,
    );
    const service = new WindyService(
      configFor({ windyApiKey: "windy-private-key" }),
      { fetchFn },
    );
    const first = await service.snapshot();
    const second = await service.snapshot();

    expect(first.status).toBe("operational");
    expect(requests).toHaveLength(1);
    expect(requests[0].headers["x-windy-api-key"]).toBe("windy-private-key");
    expect(second).toBe(first);
    expect(first.webcams[0]).toMatchObject({
      id: "1401795663",
      title: "Kinshasa river cam",
      latitude: -4.3,
      longitude: 15.3,
      thumbnail: "https://images.windy.com/thumb.jpg",
    });
    expect(first.attribution).toContain("Windy");
    expect(JSON.stringify(first)).not.toContain("windy-private-key");
  });
});

describe("FinnhubService (markets)", () => {
  it("maps quotes and never exposes the token in output", async () => {
    const requests = [];
    const fetchFn = fakeFetch(
      [
        {
          test: (url) => url.pathname.endsWith("/quote"),
          handler: () =>
            jsonResponse({
              c: 5945.2,
              d: 12.4,
              dp: 0.21,
              h: 5960,
              l: 5910,
              o: 5920,
              pc: 5932.8,
              t: 1720000000,
            }),
        },
      ],
      requests,
    );
    const service = new FinnhubService(
      configFor({ finnhubApiKey: "finnhub-private" }),
      { fetchFn },
    );
    const result = await service.snapshot();
    expect(result.status).toBe("operational");
    expect(result.quotes.length).toBeGreaterThan(5);
    expect(
      requests.every(
        (r) => r.url.searchParams.get("token") === "finnhub-private",
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain("finnhub-private");
    const spy = result.quotes.find((quote) => quote.symbol === "^GSPC");
    expect(spy).toMatchObject({
      current: 5945.2,
      change: 12.4,
      changePercent: 0.21,
    });
  });
});

describe("FirmsService (NASA FIRMS)", () => {
  it("parses CSV detections, ranks by FRP, and passes the key in the path", async () => {
    const requests = [];
    const fetchFn = fakeFetch(
      [
        {
          test: (url) => url.pathname.includes("/api/area/csv/"),
          handler: () => textResponse(csvFixture),
        },
      ],
      requests,
    );
    const service = new FirmsService(
      configFor({
        firmsApiKey: "firms-map-key",
        firms: { sources: ["VIIRS_SNPP_NRT"], area: "world", cacheSeconds: 60 },
      }),
      { fetchFn },
    );
    const result = await service.snapshot();
    expect(result.status).toBe("operational");
    expect(result.events).toHaveLength(3);
    expect(requests[0].url.pathname).toContain("firms-map-key");
    expect(requests[0].url.pathname).toContain("VIIRS_SNPP_NRT");
    const strongest = result.events[0];
    expect(strongest).toMatchObject({
      category: "natural",
      severity: "critical",
      frp: 620,
      latitude: 10.5,
      longitude: 45.2,
      sourceName: "NASA FIRMS",
    });
    expect(strongest.publishedAt).toBe("2026-08-10T14:20:00Z");
    expect(result.events.find((e) => e.frp === 45.3).severity).toBe("medium");
    expect(JSON.stringify(result)).not.toContain("firms-map-key");
  });

  it("caps ranked detections to protect response size", async () => {
    const manyRows = Array.from(
      { length: 400 },
      (_, index) =>
        `${index},${index},300,0.4,0.4,2026-08-10,1200,N,VIIRS,80,2.0,300,${index},D`,
    ).join("\n");
    const fetchFn = fakeFetch([
      {
        test: () => true,
        handler: () =>
          textResponse(`${csvFixture.split("\n")[0]}\n${manyRows}`),
      },
    ]);
    const service = new FirmsService(
      configFor({
        firmsApiKey: "k",
        firms: { sources: ["VIIRS_SNPP_NRT"], area: "world", cacheSeconds: 60 },
      }),
      { fetchFn },
    );
    const result = await service.snapshot();
    expect(result.events.length).toBeLessThanOrEqual(250);
  });
});

describe("AcledService (conflict)", () => {
  const rows = [
    {
      event_id_cnty: "UKR1",
      event_date: "2026-08-10",
      event_type: "Battles",
      sub_event_type: "Armed clash",
      country: "Ukraine",
      location: "Kharkiv",
      latitude: 49.99,
      longitude: 36.23,
      fatalities: 12,
      notes: "Artillery exchange reported near the front line.",
    },
    {
      event_id_cnty: "FRA2",
      event_date: "2026-08-09",
      event_type: "Protests",
      sub_event_type: "Peaceful protest",
      country: "France",
      location: "Paris",
      latitude: 48.85,
      longitude: 2.35,
      fatalities: 0,
      notes: "Demonstration remained peaceful.",
    },
  ];

  it("supports a direct access token", async () => {
    const requests = [];
    const fetchFn = fakeFetch(
      [
        {
          test: (url) => url.pathname.includes("/api/acled/read"),
          handler: () => jsonResponse({ status: 200, data: rows }),
        },
      ],
      requests,
    );
    const service = new AcledService(
      configFor({
        acled: { accessToken: "acled-bearer-1", email: "", password: "" },
      }),
      { fetchFn },
    );
    const result = await service.snapshot();
    expect(result.status).toBe("operational");
    expect(requests[0].headers.Authorization).toBe("Bearer acled-bearer-1");
    expect(result.events[0]).toMatchObject({
      category: "conflict",
      severity: "critical",
      region: "Europe",
      fatalities: 12,
      sourceName: "ACLED",
    });
    expect(result.events[1]).toMatchObject({
      category: "diplomacy",
      severity: "medium",
    });
    expect(JSON.stringify(result)).not.toContain("acled-bearer-1");
  });

  it("exchanges email/password for a cached OAuth token", async () => {
    const requests = [];
    const fetchFn = fakeFetch(
      [
        {
          test: (url) => url.pathname === "/oauth/token",
          handler: () =>
            jsonResponse({ access_token: "oauth-token-9", expires_in: 86400 }),
        },
        {
          test: (url) => url.pathname.includes("/api/acled/read"),
          handler: () => jsonResponse({ data: rows }),
        },
      ],
      requests,
    );
    const service = new AcledService(
      configFor({
        acled: { accessToken: "", email: "ops@example.com", password: "pw" },
      }),
      { fetchFn },
    );
    await service.snapshot({ fresh: true });
    await service.snapshot({ fresh: true });
    const tokenCalls = requests.filter(
      (r) => r.url.pathname === "/oauth/token",
    );
    const dataCalls = requests.filter((r) =>
      r.url.pathname.includes("/api/acled/read"),
    );
    expect(tokenCalls).toHaveLength(1);
    expect(dataCalls).toHaveLength(2);
    expect(tokenCalls[0].body).toContain("grant_type=password");
    expect(tokenCalls[0].body).toContain("client_id=acled");
    expect(
      dataCalls.every(
        (r) => r.headers.Authorization === "Bearer oauth-token-9",
      ),
    ).toBe(true);
  });
});

describe("EiaService (energy)", () => {
  it("maps series with prior values", async () => {
    const requests = [];
    const fetchFn = fakeFetch(
      [
        {
          test: () => true,
          handler: () =>
            jsonResponse({
              response: {
                data: [
                  { period: "2026-08-08", series: "RWTC", value: 71.23 },
                  { period: "2026-08-01", series: "RWTC", value: 70.1 },
                ],
              },
            }),
        },
      ],
      requests,
    );
    const service = new EiaService(configFor({ eiaApiKey: "eia-private" }), {
      fetchFn,
    });
    const result = await service.snapshot();
    expect(result.status).toBe("operational");
    expect(
      requests.every(
        (r) => r.url.searchParams.get("api_key") === "eia-private",
      ),
    ).toBe(true);
    const wti = result.series.find((s) => s.id === "WTI");
    expect(wti).toMatchObject({
      value: 71.23,
      previousValue: 70.1,
      period: "2026-08-08",
    });
    expect(JSON.stringify(result)).not.toContain("eia-private");
  });
});

describe("FredService (macro)", () => {
  it("maps observations (string values) and the api key", async () => {
    const requests = [];
    const fetchFn = fakeFetch(
      [
        {
          test: () => true,
          handler: () =>
            jsonResponse({
              observations: [
                { date: "2026-08-08", value: "4.08" },
                { date: "2026-08-07", value: "4.10" },
              ],
            }),
        },
      ],
      requests,
    );
    const service = new FredService(configFor({ fredApiKey: "fred-private" }), {
      fetchFn,
    });
    const result = await service.snapshot();
    expect(result.status).toBe("operational");
    expect(
      requests.every(
        (r) => r.url.searchParams.get("api_key") === "fred-private",
      ),
    ).toBe(true);
    expect(result.series).toHaveLength(6);
    const dff = result.series.find((s) => s.id === "DFF");
    expect(dff).toMatchObject({
      value: 4.08,
      previousValue: 4.1,
      date: "2026-08-08",
    });
  });
});

describe("CloudflareService (outages)", () => {
  it("maps outages and anomalies with a bearer token", async () => {
    const requests = [];
    const fetchFn = fakeFetch(
      [
        {
          test: (url) => url.pathname.includes("/outages/locations"),
          handler: () =>
            jsonResponse({
              success: true,
              result: {
                locations: [
                  {
                    locationName: "Kinshasa",
                    locationCode: "CD",
                    outages: {
                      outageCount: 3,
                      outageCountTotal: 5,
                      asns: [{ asn: 1 }, { asn: 2 }],
                    },
                  },
                ],
              },
            }),
        },
        {
          test: (url) => url.pathname.includes("/traffic_anomalies/locations"),
          handler: () =>
            jsonResponse({
              success: true,
              result: {
                locations: [
                  {
                    locationName: "Tehran",
                    locationCode: "IR",
                    anomalies: { anomalyCount: 2, asns: [] },
                  },
                ],
              },
            }),
        },
      ],
      requests,
    );
    const service = new CloudflareService(
      configFor({ cloudflareApiToken: "cf-private" }),
      { fetchFn },
    );
    const result = await service.snapshot();
    expect(result.status).toBe("operational");
    expect(
      requests.every((r) => r.headers.Authorization === "Bearer cf-private"),
    ).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      location: "Kinshasa",
      kind: "outage",
      count: 3,
      asnCount: 2,
    });
    expect(result.items[1]).toMatchObject({
      location: "Tehran",
      kind: "anomaly",
      count: 2,
    });
    expect(JSON.stringify(result)).not.toContain("cf-private");
  });

  it("degrades only the failing part", async () => {
    const fetchFn = fakeFetch([
      {
        test: (url) => url.pathname.includes("/outages/locations"),
        handler: () => jsonResponse({ error: "down" }, 500),
      },
      {
        test: () => true,
        handler: () =>
          jsonResponse({
            success: true,
            result: {
              locations: [
                { locationName: "X", anomalies: { anomalyCount: 1 } },
              ],
            },
          }),
      },
    ]);
    const service = new CloudflareService(
      configFor({ cloudflareApiToken: "cf-private" }),
      { fetchFn },
    );
    const result = await service.snapshot();
    expect(result.status).toBe("operational");
    expect(result.degradedParts).toContain("outages");
  });
});

describe("OpenSkyService (flights)", () => {
  const statesRow = [
    "abc123",
    "UAL123 ",
    "United States",
    1720000000,
    1720000000,
    -87.9,
    41.9,
    10668,
    false,
    250.1,
    180.0,
    0.0,
    null,
    10668,
    "1200",
    false,
    0,
    1,
  ];

  it("exchanges client credentials and maps aircraft states", async () => {
    const requests = [];
    const fetchFn = fakeFetch(
      [
        {
          test: (url) => url.pathname.includes("/openid-connect/token"),
          handler: () =>
            jsonResponse({ access_token: "opensky-token", expires_in: 1800 }),
        },
        {
          test: (url) => url.pathname.includes("/api/states/all"),
          handler: () =>
            jsonResponse({ time: 1720000000, states: [statesRow] }),
        },
      ],
      requests,
    );
    const service = new OpenSkyService(
      configFor({
        openSky: {
          clientId: "client-1",
          clientSecret: "secret-1",
          bbox: [-10, -30, 70, 60],
        },
      }),
      { fetchFn },
    );
    const result = await service.snapshot();
    expect(result.status).toBe("operational");
    const tokenCall = requests.find((r) =>
      r.url.pathname.includes("/openid-connect/token"),
    );
    expect(tokenCall.body).toContain("grant_type=client_credentials");
    expect(tokenCall.body).toContain("client_id=client-1");
    const statesCall = requests.find((r) =>
      r.url.pathname.includes("/states/all"),
    );
    expect(statesCall.headers.Authorization).toBe("Bearer opensky-token");
    expect(result.aircraft[0]).toMatchObject({
      callsign: "UAL123",
      originCountry: "United States",
      altitudeM: 10668,
      velocityMs: 250.1,
    });
    expect(JSON.stringify(result)).not.toContain("opensky-token");
    expect(JSON.stringify(result)).not.toContain("secret-1");
  });

  it("caches the access token across refreshes", async () => {
    const requests = [];
    const fetchFn = fakeFetch(
      [
        {
          test: (url) => url.pathname.includes("/openid-connect/token"),
          handler: () => jsonResponse({ access_token: "t", expires_in: 1800 }),
        },
        {
          test: () => true,
          handler: () => jsonResponse({ time: 1, states: [statesRow] }),
        },
      ],
      requests,
    );
    const service = new OpenSkyService(
      configFor({
        openSky: { clientId: "c", clientSecret: "s", bbox: [-10, -30, 70, 60] },
      }),
      { fetchFn },
    );
    await service.snapshot({ fresh: true });
    await service.snapshot({ fresh: true });
    const tokenCalls = requests.filter((r) =>
      r.url.pathname.includes("/openid-connect/token"),
    );
    expect(tokenCalls).toHaveLength(1);
  });
});

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    FakeWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  message(data) {
    this.onmessage?.({ data });
  }

  fail() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
}

describe("AisStreamService (ships relay)", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("never connects without a key", async () => {
    const service = new AisStreamService(configFor(), {
      WebSocketImpl: FakeWebSocket,
    });
    const result = await service.snapshot();
    expect(result.status).toBe("not-configured");
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("subscribes, tracks vessels, and keeps the key server-side", async () => {
    const service = new AisStreamService(
      configFor({ aisStreamApiKey: "ais-private" }),
      { WebSocketImpl: FakeWebSocket },
    );
    await service.snapshot();
    expect(FakeWebSocket.instances).toHaveLength(1);
    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toContain("wss://stream.aisstream.io/v0/stream");
    expect(socket.sent).toHaveLength(0);

    socket.open();
    expect(socket.sent).toHaveLength(1);
    const subscribe = JSON.parse(socket.sent[0]);
    expect(subscribe.APIKey).toBe("ais-private");
    expect(subscribe.BoundingBoxes).toEqual([
      [
        [-90, -180],
        [90, 180],
      ],
    ]);

    socket.message(
      JSON.stringify({
        MessageType: "PositionReport",
        MetaData: {
          MMSI: 211217250,
          ShipName: "TEST CARRIER",
          time_utc: "2026-08-10T12:00:00Z",
        },
        Message: {
          PositionReport: {
            Latitude: 36.2,
            Longitude: 18.4,
            Sog: 12.3,
            Cog: 90.1,
            TrueHeading: 91,
          },
        },
      }),
    );
    socket.message(
      JSON.stringify({
        MessageType: "ShipStaticData",
        MetaData: { MMSI: 211217250 },
        Message: {
          ShipStaticData: {
            ShipName: "TEST CARRIER",
            Destination: "VALETTA",
            Imo: 1234567,
          },
        },
      }),
    );

    const result = await service.snapshot();
    expect(result.status).toBe("operational");
    expect(result.vesselCount).toBe(1);
    expect(result.vessels[0]).toMatchObject({
      mmsi: 211217250,
      name: "TEST CARRIER",
      destination: "VALETTA",
      latitude: 36.2,
      longitude: 18.4,
      speedKnots: 12.3,
    });
    expect(JSON.stringify(result)).not.toContain("ais-private");
    service.close();
  });

  it("reconnects with backoff after a drop", () => {
    vi.useFakeTimers();
    const service = new AisStreamService(
      configFor({ aisStreamApiKey: "ais-private" }),
      { WebSocketImpl: FakeWebSocket },
    );
    service.ensureConnected();
    const first = FakeWebSocket.instances[0];
    first.open();
    first.fail();
    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(2_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.instances[1].open();
    expect(FakeWebSocket.instances[1].sent.length).toBe(1);
    service.close();
  });
});

describe("ProviderRegistry", () => {
  it("reports all 12 providers with no secrets", () => {
    const registry = new ProviderRegistry(configFor(), {
      media: { apiKey: "", cache: null, list: async () => ({}) },
      liveSources: { cache: null, snapshot: async () => ({}) },
      intelligence: { lastSuccessAt: null },
    });
    const status = registry.status();
    expect(status).toHaveLength(12);
    const ids = status.map((item) => item.id);
    for (const id of [
      "windy-webcams",
      "finnhub",
      "nasa-firms",
      "acled",
      "eia",
      "fred",
      "cloudflare-radar",
      "opensky",
      "aisstream",
      "youtube",
      "news",
      "ai",
    ]) {
      expect(ids).toContain(id);
    }
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("sk-");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("Bearer");
  });

  it("merges fires and conflicts into map events", async () => {
    const fetchFn = fakeFetch([
      {
        test: (url) => url.pathname.includes("/api/area/csv/"),
        handler: () => textResponse(csvFixture),
      },
      {
        test: (url) => url.pathname.includes("/api/acled/read"),
        handler: () =>
          jsonResponse({
            data: [
              {
                event_id_cnty: "UKR1",
                event_date: "2026-08-10",
                event_type: "Battles",
                country: "Ukraine",
                location: "Kharkiv",
                latitude: 49.99,
                longitude: 36.23,
                fatalities: 4,
                notes: "Clashes reported.",
              },
            ],
          }),
      },
    ]);
    const registry = new ProviderRegistry(
      configFor({
        firmsApiKey: "firms-key",
        firms: { sources: ["VIIRS_SNPP_NRT"], area: "world", cacheSeconds: 60 },
        acled: { accessToken: "acled-key", email: "", password: "" },
      }),
      { fetchFn },
    );
    const events = await registry.events();
    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(events.some((event) => event.sourceName === "NASA FIRMS")).toBe(
      true,
    );
    expect(events.some((event) => event.sourceName === "ACLED")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("firms-key");
    expect(JSON.stringify(events)).not.toContain("acled-key");
    registry.close();
  });
});
