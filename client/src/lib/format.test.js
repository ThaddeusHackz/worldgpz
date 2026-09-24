import { describe, expect, it } from "vitest";
import { compactNumber, formatUtc, relativeTime, titleCase } from "./format.js";

describe("formatting utilities", () => {
  it("formats relative timestamps", () => {
    expect(
      relativeTime(
        "2026-08-10T11:00:00Z",
        new Date("2026-08-10T12:00:00Z").getTime(),
      ),
    ).toBe("1 hour ago");
  });

  it("formats labels and compact values", () => {
    expect(titleCase("high_priority")).toBe("High Priority");
    expect(compactNumber(1280)).toBe("1.3K");
  });

  it("formats a valid UTC timestamp", () => {
    expect(formatUtc("2026-08-10T11:05:00Z")).toBe("Aug 10, 11:05");
  });

  /**
   * Regression: Intl throws RangeError("Invalid time value") on a bad date,
   * which previously took down Dashboard and Operations entirely when a
   * payload arrived without `generatedAt`.
   */
  it("does not throw on missing or malformed timestamps", () => {
    for (const bad of [undefined, null, "", "not-a-date", NaN, {}, []]) {
      expect(() => formatUtc(bad)).not.toThrow();
      expect(formatUtc(bad)).toBe("—");
    }
  });

  it("does not throw on a missing relative timestamp", () => {
    expect(() => relativeTime(undefined)).not.toThrow();
    expect(relativeTime(undefined)).toBe("Unknown time");
  });
});
