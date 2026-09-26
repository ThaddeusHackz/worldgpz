// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { ChokepointBoard, RiskIndex, WireTicker } from "./IntelPanels.jsx";

describe("WireTicker", () => {
  it("renders event headlines", () => {
    const html = renderToString(
      <WireTicker
        news={[]}
        events={[{ id: "e1", title: "Escalation reported", severity: "high" }]}
      />,
    );
    expect(html).toContain("wire-ticker");
    expect(html).toContain("Escalation reported");
  });

  it("explains itself when there is nothing to show", () => {
    const html = renderToString(<WireTicker news={[]} events={[]} />);
    expect(html).toContain("No headlines in the current snapshot");
    expect(html).not.toContain("wire-item");
  });
});

describe("RiskIndex", () => {
  it("renders country rows with score and delta", () => {
    const html = renderToString(
      <RiskIndex
        risk={{
          countries: [
            {
              country: "Yemen",
              score: 72,
              level: "critical",
              delta: 5,
              signals: 3,
              drivers: [{ label: "conflict", share: 80 }],
            },
          ],
          regions: [],
          basis: "1 country from 3 live signals",
        }}
      />,
    );
    expect(html).toContain("Yemen");
    expect(html).toContain("72");
    expect(html).toContain("▲");
    expect(html).toContain("1 country from 3 live signals");
  });

  it("falls back to region rows without inventing countries", () => {
    const html = renderToString(
      <RiskIndex
        risk={{
          countries: [],
          regions: [{ region: "Horn of Africa", score: 43, signals: 2 }],
          basis: "no country-attributable signals; 1 region-level rollups",
        }}
      />,
    );
    expect(html).toContain("Horn of Africa");
    expect(html).toContain("Regional risk index");
  });

  it("shows an honest empty state", () => {
    const html = renderToString(
      <RiskIndex risk={{ countries: [], regions: [] }} />,
    );
    expect(html).toContain("No country-attributable signals yet");
  });

  it("survives a missing risk payload", () => {
    const html = renderToString(<RiskIndex />);
    expect(html).toContain("No country-attributable signals yet");
  });
});

describe("ChokepointBoard", () => {
  it("renders disrupted routes and the summary counts", () => {
    const html = renderToString(
      <ChokepointBoard
        chokepoints={{
          chokepoints: [
            {
              name: "Strait of Hormuz",
              region: "Middle East",
              disruption: 64,
              status: "disrupted",
              signals: 2,
              matched: [],
            },
            {
              name: "Panama Canal",
              region: "Americas",
              disruption: 0,
              status: "monitoring",
              signals: 0,
              matched: [],
            },
          ],
          disrupted: 1,
          strained: 0,
          total: 13,
          basis: "scored against 6 live signals",
        }}
      />,
    );
    expect(html).toContain("Strait of Hormuz");
    expect(html).toContain("1 disrupted");
    // Only the active route is listed when something is disrupted.
    expect(html).not.toContain("Panama Canal");
  });

  it("lists baseline routes and says so when nothing is disrupted", () => {
    const html = renderToString(
      <ChokepointBoard
        chokepoints={{
          chokepoints: [
            {
              name: "Panama Canal",
              region: "Americas",
              disruption: 0,
              status: "monitoring",
              signals: 0,
              matched: [],
            },
          ],
          disrupted: 0,
          strained: 0,
          total: 13,
          basis: "no live signals available — all routes at baseline",
        }}
      />,
    );
    expect(html).toContain("Panama Canal");
    expect(html).toContain("All routes at baseline");
  });

  it("survives a missing payload", () => {
    const html = renderToString(<ChokepointBoard />);
    expect(html).toContain("No chokepoint data in this snapshot");
  });
});
