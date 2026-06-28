import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, normalizeStatus } from "./applications";

describe("normalizeStatus", () => {
  it("accepts every known status", () => {
    for (const s of APPLICATION_STATUSES) {
      expect(normalizeStatus(s)).toBe(s);
    }
  });

  it("falls back to 'saved' for unknown/garbage", () => {
    expect(normalizeStatus("bogus")).toBe("saved");
    expect(normalizeStatus(null)).toBe("saved");
    expect(normalizeStatus(undefined)).toBe("saved");
  });
});
