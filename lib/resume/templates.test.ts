import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATE,
  RESUME_TEMPLATES,
  normalizeTemplate,
} from "./templates";

describe("normalizeTemplate", () => {
  it("accepts every registered template id", () => {
    for (const tpl of RESUME_TEMPLATES) {
      expect(normalizeTemplate(tpl.id)).toBe(tpl.id);
    }
  });

  it("falls back to the default for unknown/garbage", () => {
    expect(normalizeTemplate("bogus")).toBe(DEFAULT_TEMPLATE);
    expect(normalizeTemplate(null)).toBe(DEFAULT_TEMPLATE);
    expect(normalizeTemplate(123)).toBe(DEFAULT_TEMPLATE);
  });
});
