// @vitest-environment jsdom
/**
 * Client runtime forensic harness.
 *
 * The existing render.test.jsx uses renderToString, which never runs effects —
 * so useEffect crashes, bad fetch handling, and unguarded property access in
 * live data paths stay invisible to it. This mounts the real components in a
 * DOM, fed by fixtures captured from a booted server
 * (client/src/__fixtures__/api-real.json), and records every thrown error and
 * console.error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./lib/auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Operations from "./pages/Operations.jsx";
import Login from "./pages/Login.jsx";
import Admin from "./pages/Admin.jsx";
import fixtures from "./__fixtures__/api-real.json";

let problems;

/** Serve the captured real payloads; unknown paths return a valid empty shape. */
function mockFetch() {
  return vi.fn(async (input) => {
    const url = String(typeof input === "string" ? input : input.url);
    const path = url.split("?")[0];
    const body = fixtures[path] ?? { success: true, data: [] };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

async function mount(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter>{element}</MemoryRouter>);
  });
  // Let effects, timers and promise chains settle.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  return { container, root };
}

/** Mount the way main.jsx does: everything lives inside AuthProvider. */
const mountPage = (element) => mount(<AuthProvider>{element}</AuthProvider>);

beforeEach(() => {
  problems = [];
  // Required for React 19's act() to run outside @testing-library.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = mockFetch();
  // jsdom lacks these; stub so components do not fail for unrelated reasons.
  globalThis.matchMedia ??= () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLCanvasElement.prototype.getContext ??= () => null;
  globalThis.EventSource ??= class {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
  };

  vi.spyOn(console, "error").mockImplementation((...args) => {
    const text = args
      .map((a) => (a instanceof Error ? a.stack : String(a)))
      .join(" ");
    if (/not wrapped in act|ReactDOMTestUtils/.test(text)) return;
    problems.push(`console.error: ${text.slice(0, 2000)}`);
  });
  window.addEventListener("error", (event) => {
    problems.push(`window.error: ${event.error?.stack || event.message}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    problems.push(`unhandledrejection: ${event.reason?.stack || event.reason}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
});

const report = (label) =>
  `${label}: ${problems.length} problem(s)\n${problems.join("\n")}`;

describe("client runtime — pages must mount clean against real API fixtures", () => {
  it("Dashboard mounts clean", async () => {
    const { root } = await mountPage(<Dashboard />);
    expect(report("Dashboard")).toBe("Dashboard: 0 problem(s)\n");
    await act(async () => root.unmount());
  });

  it("Operations mounts clean", async () => {
    const { root } = await mountPage(<Operations />);
    expect(report("Operations")).toBe("Operations: 0 problem(s)\n");
    await act(async () => root.unmount());
  });

  it("Login mounts clean", async () => {
    const { root } = await mountPage(<Login />);
    expect(report("Login")).toBe("Login: 0 problem(s)\n");
    await act(async () => root.unmount());
  });

  it("Admin mounts clean", async () => {
    const { root } = await mountPage(<Admin />);
    expect(report("Admin")).toBe("Admin: 0 problem(s)\n");
    await act(async () => root.unmount());
  });

  it("Operations renders no nested anchors", async () => {
    const { container, root } = await mountPage(<Operations />);
    // Invalid HTML: browsers split the tree and React logs a hydration error.
    const nested = container.querySelectorAll("a a");
    expect(`nested <a> count: ${nested.length}`).toBe("nested <a> count: 0");
    await act(async () => root.unmount());
  });

  it("Dashboard survives a total API outage without a crash-class error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const { container, root } = await mountPage(<Dashboard />);
    expect(container.textContent.length).toBeGreaterThan(0);
    const crashes = problems.filter((p) =>
      /Cannot read|is not a function|is not iterable|undefined is not/i.test(p),
    );
    expect(`crashes: ${crashes.length}\n${crashes.join("\n")}`).toBe(
      "crashes: 0\n",
    );
    await act(async () => root.unmount());
  });

  it("Operations survives a total API outage without a crash-class error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const { container, root } = await mountPage(<Operations />);
    expect(container.textContent.length).toBeGreaterThan(0);
    const crashes = problems.filter((p) =>
      /Cannot read|is not a function|is not iterable|undefined is not/i.test(p),
    );
    expect(`crashes: ${crashes.length}\n${crashes.join("\n")}`).toBe(
      "crashes: 0\n",
    );
    await act(async () => root.unmount());
  });
});
