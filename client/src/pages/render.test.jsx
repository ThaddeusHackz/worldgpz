// @vitest-environment jsdom
/**
 * Server-render smoke tests: every public page must render end-to-end
 * without throwing, against a mocked API surface. This guards the
 * cinematic HUD from runtime regressions in CI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../lib/auth.jsx";
import Dashboard from "./Dashboard.jsx";
import Operations from "./Operations.jsx";
import Login from "./Login.jsx";
import NotFound from "./NotFound.jsx";

const now = new Date().toISOString();

const dashboardPayload = {
  success: true,
  data: {
    metrics: {
      activeSignals: 24,
      criticalSignals: 2,
      highPriority: 5,
      seismic24h: 9,
      sourcesOnline: 5,
      sourcesTotal: 6,
      riskScore: 47,
    },
    events: [
      {
        id: "usgs-test-1",
        title: "M 5.4 test quake",
        summary: "Magnitude 5.4 seismic event.",
        category: "seismic",
        severity: "high",
        region: "Global",
        country: "Test place",
        latitude: 10,
        longitude: 20,
        sourceName: "USGS",
        sourceUrl: "https://example.com/quake",
        publishedAt: now,
      },
      {
        id: "baseline-test-2",
        title: "Corridor watch",
        summary: "Baseline watch item.",
        category: "infrastructure",
        severity: "medium",
        region: "Middle East",
        country: "Regional",
        latitude: 16.4,
        longitude: 41.2,
        sourceName: "WORLDGPZ baseline",
        sourceUrl: "",
        publishedAt: now,
      },
    ],
    news: [
      {
        id: "reliefweb-1",
        title: "Field report headline",
        sourceName: "ReliefWeb",
        sourceUrl: "https://example.com/report",
        publishedAt: now,
      },
    ],
    sourceStatus: [
      {
        id: "usgs",
        name: "USGS",
        type: "Seismic",
        coverage: "Global",
        status: "operational",
        latencyMs: 120,
      },
    ],
    trend: Array.from({ length: 12 }, (_, index) => ({
      label: `${String(index * 2).padStart(2, "0")}:00`,
      signals: 4 + index,
      priority: index % 3,
    })),
    layers: [],
    regions: [],
    correlations: [],
    generatedAt: now,
    mode: "live-plus-curated",
  },
};

function mockFetch(url) {
  const path = String(url);
  const body = path.includes("/api/v1/dashboard")
    ? dashboardPayload
    : path.includes("/api/auth/me")
      ? { success: false }
      : path.includes("/api/v1/providers")
        ? { success: true, data: [] }
        : path.includes("/api/v1/media/channels")
          ? {
              success: true,
              data: {
                configured: false,
                status: "not-configured",
                liveCount: 0,
                channels: [
                  { id: "c1", name: "Network One", status: "offline" },
                ],
              },
            }
          : {
              success: true,
              data: { configured: false, status: "not-configured" },
            };
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(mockFetch));
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("page render smoke", () => {
  it("renders the GOD'S EYE command dashboard", async () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </MemoryRouter>,
    );
    await Promise.resolve();
    expect(html).toContain("WORLDGPZ");
    expect(html).toContain("One eye on the world");
    expect(html).toContain("Intercept console");
    expect(html).toContain("Global scan");
    expect(html).toContain("Live target map");
  });

  it("renders the tactical operations room shell", async () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/operations"]}>
        <AuthProvider>
          <Operations />
        </AuthProvider>
      </MemoryRouter>,
    );
    await Promise.resolve();
    // Data loads in client effects; SSR shows the themed loading state.
    expect(html).toContain("Building operational picture");
  });

  it("renders the secure access terminal", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(html).toContain("Identify yourself");
    expect(html).toContain("Authenticate");
  });

  it("renders the signal-lost page for unknown routes", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/nowhere"]}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(html).toContain("Off the grid");
  });
});
