import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECTION_ORDER,
  SECTION_KEYS,
  normalizeSectionOrder,
} from "./sections";

describe("normalizeSectionOrder", () => {
  it("returns the default order for null/garbage input", () => {
    expect(normalizeSectionOrder(null)).toEqual(DEFAULT_SECTION_ORDER);
    expect(normalizeSectionOrder("nope")).toEqual(DEFAULT_SECTION_ORDER);
    expect(normalizeSectionOrder([1, 2, 3])).toEqual(DEFAULT_SECTION_ORDER);
  });

  it("keeps valid keys in the given order", () => {
    const order = ["skills", "summary"];
    const out = normalizeSectionOrder(order);
    expect(out.slice(0, 2)).toEqual(["skills", "summary"]);
  });

  it("drops unknown keys and dedupes", () => {
    const out = normalizeSectionOrder([
      "skills",
      "skills",
      "bogus",
      "awards",
    ]);
    expect(out.filter((k) => k === "skills")).toHaveLength(1);
    expect(out).not.toContain("bogus");
  });

  it("always appends missing keys so new sections still render", () => {
    const out = normalizeSectionOrder(["awards"]);
    expect(new Set(out)).toEqual(new Set(SECTION_KEYS));
    expect(out).toHaveLength(SECTION_KEYS.length);
    expect(out[0]).toBe("awards");
  });
});
