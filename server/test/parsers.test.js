import { describe, expect, it } from "vitest";
import {
  parseGdeltGeo,
  parsePlanetaryKp,
  parseSolarWindSpeed,
  parseTleFile,
} from "../src/services/parsers.js";

describe("GDELT GEO parser", () => {
  it("maps features to geolocated signals with volume-scaled severity", () => {
    const payload = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [2.35, 48.85] },
          properties: {
            name: "Military parade in Paris amid heightened security",
            count: 320,
            html: '<a href="https://example.com/a1">story</a>',
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-74, 40.7] },
          properties: {
            name: "Protests continue for a third night",
            count: 90,
            html: "",
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [139.7, 35.7] },
          properties: {
            name: "Typhoon approaches the coast",
            count: 12,
            html: "",
          },
        },
      ],
    };
    const events = parseGdeltGeo(payload, { now: "2026-01-01T00:00:00Z" });
    expect(events).toHaveLength(3);
    expect(events[0].articleVolume).toBe(320);
    expect(events[0].category).toBe("conflict");
    expect(events[0].sourceUrl).toBe("https://example.com/a1");
    expect(events.some((event) => event.category === "civil")).toBe(true);
    expect(events.some((event) => event.category === "climate")).toBe(true);
    expect(events.every((event) => Number.isFinite(event.latitude))).toBe(true);
  });

  it("drops malformed features and tolerates empty payloads", () => {
    expect(parseGdeltGeo(null)).toEqual([]);
    expect(
      parseGdeltGeo({ features: [{ geometry: { coordinates: [0] } }] }),
    ).toEqual([]);
  });
});

describe("NOAA SWPC parsers", () => {
  it("reads the planetary K-index and classifies storms", () => {
    const rows = [
      ["time_tag", "Kp", "observed", "noaa_scale"],
      ["2026-01-01 00:00:00", "3", "observed", ""],
      ["2026-01-01 03:00:00", "5.33", "observed", "G1"],
    ];
    const kp = parsePlanetaryKp(rows);
    expect(kp.kp).toBeCloseTo(5.33);
    expect(kp.storm).toBe(true);
    expect(kp.level).toBe("storm");
    expect(parsePlanetaryKp([])).toBeNull();
  });

  it("reads solar wind speed and skips bad rows", () => {
    const rows = [
      ["time_tag", "speed"],
      ["2026-01-01 00:00", "0"],
      ["2026-01-01 00:01", "410"],
    ];
    expect(parseSolarWindSpeed(rows).speed).toBe(410);
    expect(parseSolarWindSpeed([["time_tag", "speed"]])).toBeNull();
  });
});

describe("CelesTrak TLE parser", () => {
  it("extracts wanted three-line element sets in priority order", () => {
    const text = [
      "CSS (TIANHE)",
      "1 48274U 21035A   26260.51798596  .00007946  00000+0  21274-3 0  9995",
      "2 48274  41.4729 280.2644 0004192 302.8394  57.2573 15.50041234567890",
      "ISS (ZARYA)",
      "1 25544U 98067A   26260.91254630  .00016717  00000+0  30864-3 0  9990",
      "2 25544  51.6416 247.4627 0006703 130.5362 325.0288 15.49515080473920",
      "WEIRD SAT",
      "1 99999U 26001A   26260.00000000  .00000000  00000+0  00000+0 0  9998",
      "2 99999   0.0000   0.0000 0000000 000.0000 000.0000  0.00000000000000",
    ].join("\n");
    const sats = parseTleFile(text);
    expect(sats[0].name).toBe("ISS (ZARYA)");
    expect(sats[1].name).toBe("CSS (TIANHE)");
    expect(sats).toHaveLength(2);
    expect(sats[0].line1.startsWith("1 25544")).toBe(true);
  });
});
