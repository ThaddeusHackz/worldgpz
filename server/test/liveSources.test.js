import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSourcesService } from "../src/services/liveSources.js";

const config = {
  fetchTimeoutMs: 5_000,
  sourceCacheSeconds: 300,
  newsApiKey: "",
};

const good = (id, mag) => ({
  type: "Feature",
  id,
  properties: {
    mag,
    place: `${mag} km from Test City`,
    time: Date.parse("2026-09-20T08:15:00Z"),
    tsunami: 0,
    title: `M ${mag} - near Test City`,
    url: `https://earthquake.usgs.gov/${id}`,
  },
  geometry: { type: "Point", coordinates: [139.5, 35.2, 12.5] },
});

/** Stub fetch so only the USGS call resolves; everything else fails fast. */
function stubFetch(usgsPayload) {
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes("earthquake.usgs.gov"))
      return new Response(JSON.stringify(usgsPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    return new Response("{}", { status: 500 });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LiveSourcesService earthquake mapping", () => {
  /**
   * Regression: USGS emits features with `geometry: null`. The unguarded
   * mapper threw inside `.map`, the whole `#earthquakes()` call rejected, and
   * Promise.allSettled reported the entire earthquake feed as degraded — so
   * real seismic events vanished from the dashboard.
   */
  it("keeps good events when one feature has null geometry", async () => {
    stubFetch({
      features: [
        good("us1", 6.4),
        {
          type: "Feature",
          id: "us-bad",
          properties: { mag: 5, title: "x" },
          geometry: null,
        },
        good("us3", 4.7),
      ],
    });

    const service = new LiveSourcesService(config);
    const snapshot = await service.snapshot({ fresh: true });

    const ids = snapshot.earthquakes.map((event) => event.id);
    expect(ids).toEqual(["usgs-us1", "usgs-us3"]);

    const usgs = snapshot.sourceStatus.find((s) => s.id === "usgs");
    expect(usgs.status).toBe("operational");
    expect(usgs.items).toBe(2);
  });

  it("maps severity, coordinates and timestamps correctly", async () => {
    stubFetch({ features: [good("us1", 6.4)] });
    const service = new LiveSourcesService(config);
    const snapshot = await service.snapshot({ fresh: true });
    expect(snapshot.earthquakes[0]).toMatchObject({
      id: "usgs-us1",
      category: "seismic",
      severity: "critical",
      latitude: 35.2,
      longitude: 139.5,
      magnitude: 6.4,
      sourceName: "USGS",
      publishedAt: "2026-09-20T08:15:00.000Z",
    });
  });

  it("degrades gracefully on a malformed payload instead of throwing", async () => {
    stubFetch({ notFeatures: true });
    const service = new LiveSourcesService(config);
    const snapshot = await service.snapshot({ fresh: true });
    expect(snapshot.earthquakes).toEqual([]);
  });

  it("survives an invalid timestamp", async () => {
    const broken = good("usT", 5.2);
    broken.properties.time = "not-a-timestamp";
    stubFetch({ features: [broken] });
    const service = new LiveSourcesService(config);
    const snapshot = await service.snapshot({ fresh: true });
    expect(snapshot.earthquakes).toHaveLength(1);
    expect(() => new Date(snapshot.earthquakes[0].publishedAt)).not.toThrow();
  });
});
