import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SSE event-name contract.
 *
 * The realtime stream broke silently when the server emitted `signals` while
 * the client listened for `signal` — no error, no warning, the live feed just
 * never updated. This test reads both sides of the wire and asserts every
 * emitted event name is actually handled by the client.
 */
const root = path.resolve(import.meta.dirname, "../../..");
const pulseSource = readFileSync(
  path.join(root, "server/src/services/pulse.js"),
  "utf8",
);
const streamSource = readFileSync(
  path.join(root, "client/src/lib/useLiveStream.js"),
  "utf8",
);

const emitted = [...pulseSource.matchAll(/#emit\(\s*"([^"]+)"/g)].map(
  (match) => match[1],
);
const listened = [...streamSource.matchAll(/addEventListener\(\s*"([^"]+)"/g)]
  .map((match) => match[1])
  // Browser lifecycle events, not server-emitted frames.
  .filter((name) => name !== "open" && name !== "error");

describe("SSE event-name contract", () => {
  it("parses both sides of the wire", () => {
    expect(emitted.length).toBeGreaterThan(0);
    expect(listened.length).toBeGreaterThan(0);
  });

  it("client handles every event the server emits", () => {
    const unhandled = emitted.filter((name) => !listened.includes(name));
    expect(`emitted but not handled: ${unhandled.join(", ")}`).toBe(
      "emitted but not handled: ",
    );
  });

  it("client does not listen for events the server never emits", () => {
    const orphaned = listened.filter((name) => !emitted.includes(name));
    expect(`handled but never emitted: ${orphaned.join(", ")}`).toBe(
      "handled but never emitted: ",
    );
  });

  it("emits the expected realtime frames", () => {
    expect(emitted.sort()).toEqual(["pulse", "signals"]);
  });
});
