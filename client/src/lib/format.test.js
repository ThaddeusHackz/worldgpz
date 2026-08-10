import { describe, expect, it } from "vitest";
import { compactNumber, relativeTime, titleCase } from "./format.js";

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
});
