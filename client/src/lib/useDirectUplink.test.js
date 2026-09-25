import { describe, expect, it } from "vitest";
import { mapUsgs, mapEonet } from "./useDirectUplink.js";

/** A realistic USGS feature. */
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

describe("mapUsgs", () => {
  it("maps a well-formed feed", () => {
    const events = mapUsgs({ features: [good("us1", 6.4), good("us2", 4.8)] });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: "usgs-us1",
      category: "seismic",
      severity: "critical",
      latitude: 35.2,
      longitude: 139.5,
      magnitude: 6.4,
      sourceName: "USGS",
      path: "DIRECT",
    });
    expect(events[0].publishedAt).toBe("2026-09-20T08:15:00.000Z");
    expect(events[1].severity).toBe("medium");
  });

  /**
   * Regression: USGS emits features with `geometry: null`. One such entry used
   * to throw inside the `.map`, and since the caller wraps the whole mapper in
   * a single `.catch`, the entire batch was discarded and the source reported
   * OFFLINE — real earthquakes silently disappeared from the grid.
   */
  it("keeps good events when one feature has null geometry", () => {
    const events = mapUsgs({
      features: [
        good("us1", 5.5),
        {
          type: "Feature",
          id: "us-bad",
          properties: { mag: 5, title: "x" },
          geometry: null,
        },
        good("us3", 7.1),
      ],
    });
    expect(events.map((e) => e.id)).toEqual(["usgs-us1", "usgs-us3"]);
  });

  it("keeps a coordinate-only feature with safe fallbacks", () => {
    const events = mapUsgs({
      features: [
        {
          type: "Feature",
          id: "us-bare",
          geometry: { coordinates: [1, 2, 3] },
        },
        good("us9", 5.1),
      ],
    });
    // Coordinates are valid, so the event is kept rather than dropped; only
    // the missing metadata falls back.
    expect(events.map((e) => e.id)).toEqual(["usgs-us-bare", "usgs-us9"]);
    expect(events[0].title).toBe("Seismic event us-bare");
    expect(events[0].magnitude).toBeNull();
    expect(events[0].country).toBe("Unknown");
  });

  it("survives an invalid timestamp instead of throwing", () => {
    const broken = good("usT", 5.2);
    broken.properties.time = "not-a-timestamp";
    const events = mapUsgs({ features: [broken] });
    expect(events).toHaveLength(1);
    expect(() => new Date(events[0].publishedAt).toISOString()).not.toThrow();
  });

  it("handles empty, null and malformed payloads", () => {
    expect(mapUsgs(null)).toEqual([]);
    expect(mapUsgs(undefined)).toEqual([]);
    expect(mapUsgs({})).toEqual([]);
    expect(mapUsgs({ features: "nope" })).toEqual([]);
    expect(mapUsgs({ features: [null, undefined, {}] })).toEqual([]);
  });

  it("caps the batch at 40 events", () => {
    const many = Array.from({ length: 60 }, (_, i) => good(`us${i}`, 5));
    expect(mapUsgs({ features: many })).toHaveLength(40);
  });
});

describe("mapEonet", () => {
  it("skips non-point geometries and keeps the rest", () => {
    const events = mapEonet({
      events: [
        {
          id: "E1",
          title: "Wildfire",
          categories: [{ title: "Wildfires" }],
          geometry: [
            { type: "Polygon", coordinates: [[[0, 0]]], date: "2026-09-01" },
            { type: "Point", coordinates: [12.5, 41.9], date: "2026-09-02" },
          ],
          link: "https://eonet.gsfc.nasa.gov/E1",
        },
        { id: "E2", title: "No geometry" },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "eonet-E1",
      severity: "high",
      latitude: 41.9,
      longitude: 12.5,
      publishedAt: "2026-09-02",
    });
  });

  it("handles null payloads", () => {
    expect(mapEonet(null)).toEqual([]);
    expect(mapEonet({ events: null })).toEqual([]);
  });
});
