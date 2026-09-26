import { describe, expect, it } from "vitest";

import {
  CHOKEPOINTS,
  COUNTRY_GAZETTEER,
  chokepointStatus,
  countryRisk,
} from "../src/services/situational.js";

const NOW = Date.parse("2026-09-26T12:00:00.000Z");
const hoursAgo = (n) => new Date(NOW - n * 3_600_000).toISOString();

describe("countryRisk", () => {
  it("scores a country with more severe recent signals higher", () => {
    const { countries } = countryRisk(
      [
        {
          country: "Yemen",
          severity: "critical",
          timestamp: hoursAgo(1),
          category: "conflict",
        },
        {
          country: "Yemen",
          severity: "high",
          timestamp: hoursAgo(2),
          category: "conflict",
        },
        {
          country: "Chile",
          severity: "low",
          timestamp: hoursAgo(3),
          category: "seismic",
        },
      ],
      [],
      { now: NOW },
    );

    expect(countries[0].country).toBe("Yemen");
    // Yemen: critical (10 x 1.0) + high (6 x 0.75) = 14.5 pressure -> ~55
    expect(countries[0].score).toBeGreaterThan(40);
    expect(countries[0].score).toBeLessThan(100);
    expect(countries[0].level).toBe("high");
    // Chile: a single low signal stays near the floor, never a false 100.
    expect(countries.at(-1).country).toBe("Chile");
    expect(countries.at(-1).score).toBeLessThan(15);
    expect(countries.at(-1).score).toBeLessThan(countries[0].score);
  });

  it("returns an empty, explained result rather than invented numbers", () => {
    const result = countryRisk([], [], { now: NOW });
    expect(result.countries).toEqual([]);
    expect(result.basis).toMatch(/no country-attributable signals/);
  });

  it("ignores unattributable rows instead of creating a junk country", () => {
    const { countries } = countryRisk(
      [
        { country: "Unknown", severity: "critical", timestamp: hoursAgo(1) },
        { country: "Global", severity: "critical", timestamp: hoursAgo(1) },
        { severity: "critical", timestamp: hoursAgo(1) },
      ],
      [],
      { now: NOW },
    );
    expect(countries).toEqual([]);
  });

  it("does not report 100 for a lone minor signal (regression: relative scaling)", () => {
    // Under relative-to-peak scaling a single low signal was the peak and so
    // scored a full 100 / "critical", which read as invented data.
    const { countries } = countryRisk(
      [{ country: "Lesotho", severity: "low", timestamp: hoursAgo(1) }],
      [],
      { now: NOW },
    );
    expect(countries).toHaveLength(1);
    expect(countries[0].score).toBeLessThan(20);
    expect(countries[0].level).toBe("low");
  });

  it("computes a delta against the previous pass", () => {
    const history = new Map();
    const first = countryRisk(
      [{ country: "Sudan", severity: "high", timestamp: hoursAgo(1) }],
      [],
      { now: NOW, history },
    );
    expect(first.countries[0].delta).toBeNull();

    const second = countryRisk(
      [
        { country: "Sudan", severity: "critical", timestamp: hoursAgo(1) },
        { country: "Sudan", severity: "critical", timestamp: hoursAgo(1) },
      ],
      [],
      { now: NOW, history },
    );
    expect(second.countries[0].delta).toBeGreaterThan(0);
  });

  it("survives malformed input", () => {
    const result = countryRisk(
      [null, undefined, { country: 42, severity: "critical" }, {}],
      [null, { title: 99 }],
      { now: NOW },
    );
    expect(result).toHaveProperty("countries");
    expect(Array.isArray(result.countries)).toBe(true);
  });

  it("caps the list at 20 countries", () => {
    const events = COUNTRY_GAZETTEER.slice(0, 40).map((country) => ({
      country,
      severity: "high",
      timestamp: hoursAgo(1),
    }));
    const { countries } = countryRisk(events, [], { now: NOW });
    expect(countries).toHaveLength(20);
  });

  it("attributes a signal by the country named in its text, not the country field", () => {
    const { countries } = countryRisk(
      [
        {
          // Seed rows label this "Regional"; the real place is in the text.
          country: "Regional",
          place: "12km north of Valparaiso, Chile",
          severity: "high",
          timestamp: hoursAgo(1),
        },
      ],
      [],
      { now: NOW },
    );
    expect(countries.map((row) => row.country)).toEqual(["Chile"]);
  });

  it("never emits placeholder pseudo-countries", () => {
    const { countries } = countryRisk(
      [
        {
          country: "Regional",
          title: "Regional briefing",
          severity: "critical",
          timestamp: hoursAgo(1),
        },
        {
          country: "Global",
          title: "Global markets move",
          severity: "critical",
          timestamp: hoursAgo(1),
        },
      ],
      [],
      { now: NOW },
    );
    expect(countries).toEqual([]);
  });
});

describe("chokepointStatus", () => {
  it("returns every reference chokepoint even with no signals", () => {
    const result = chokepointStatus([], [], { now: NOW });
    expect(result.chokepoints).toHaveLength(CHOKEPOINTS.length);
    expect(result.disrupted).toBe(0);
    expect(result.chokepoints.every((row) => row.disruption === 0)).toBe(true);
    expect(result.chokepoints.every((row) => row.status === "monitoring")).toBe(
      true,
    );
    expect(result.basis).toMatch(/no live signals/);
  });

  it("raises disruption when a chokepoint is named with disruption terms", () => {
    const result = chokepointStatus(
      [
        {
          title:
            "Tanker attacked in the Strait of Hormuz, shipping lane closed",
          summary: "Vessel seized near the strait; naval escort requested.",
          severity: "critical",
          timestamp: hoursAgo(1),
        },
      ],
      [],
      { now: NOW },
    );
    const hormuz = result.chokepoints.find(
      (row) => row.name === "Strait of Hormuz",
    );
    expect(hormuz.disruption).toBeGreaterThan(0);
    expect(hormuz.signals).toBe(1);
    expect(["strained", "disrupted"]).toContain(hormuz.status);
  });

  it("leaves unrelated chokepoints at baseline", () => {
    const result = chokepointStatus(
      [
        {
          title: "Tanker attacked in the Strait of Hormuz",
          severity: "critical",
          timestamp: hoursAgo(1),
        },
      ],
      [],
      { now: NOW },
    );
    const panama = result.chokepoints.find(
      (row) => row.name === "Panama Canal",
    );
    expect(panama.disruption).toBe(0);
    expect(panama.status).toBe("monitoring");
  });

  it("clamps disruption to 0-100", () => {
    const events = Array.from({ length: 60 }, () => ({
      title: "Strait of Hormuz blockade, tanker seized, naval escalation",
      severity: "critical",
      timestamp: hoursAgo(1),
    }));
    const result = chokepointStatus(events, [], { now: NOW });
    const hormuz = result.chokepoints.find(
      (row) => row.name === "Strait of Hormuz",
    );
    expect(hormuz.disruption).toBeLessThanOrEqual(100);
    expect(hormuz.disruption).toBeGreaterThanOrEqual(0);
    expect(result.disrupted).toBeGreaterThan(0);
  });

  it("survives malformed input", () => {
    const result = chokepointStatus([null, {}, { title: null }], [undefined], {
      now: NOW,
    });
    expect(result.chokepoints).toHaveLength(CHOKEPOINTS.length);
  });
});

describe("region rollup", () => {
  it("reports region-level pressure when no country resolves", () => {
    const result = countryRisk(
      [
        {
          country: "Regional",
          title:
            "Humanitarian access constraints tracked across the Horn of Africa",
          severity: "high",
          timestamp: hoursAgo(1),
        },
        {
          country: "Regional",
          title: "Red Sea shipping corridor remains under enhanced monitoring",
          severity: "high",
          timestamp: hoursAgo(1),
        },
      ],
      [],
      { now: NOW },
    );
    expect(result.countries).toEqual([]);
    expect(result.regions.map((row) => row.region).sort()).toEqual([
      "Horn of Africa",
      "Red Sea",
    ]);
    expect(result.basis).toMatch(/region-level rollups/);
    expect(result.regions.every((row) => row.score > 0)).toBe(true);
  });

  it("emits both country and region entries from the same signal", () => {
    const result = countryRisk(
      [
        {
          country: "Regional",
          title:
            "Escalation reported in eastern Ukraine and across Eastern Europe",
          severity: "critical",
          timestamp: hoursAgo(1),
        },
      ],
      [],
      { now: NOW },
    );
    expect(result.countries.map((row) => row.country)).toContain("Ukraine");
    expect(result.regions.map((row) => row.region)).toContain("Eastern Europe");
  });

  it("returns an empty regions list with no signals at all", () => {
    const result = countryRisk([], [], { now: NOW });
    expect(result.regions).toEqual([]);
  });
});
