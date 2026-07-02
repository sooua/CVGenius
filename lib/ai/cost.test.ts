import { describe, expect, it } from "vitest";
import { estimateCostMilli } from "./cost";

describe("estimateCostMilli", () => {
  it("is zero when there are no tokens", () => {
    expect(estimateCostMilli("deepseek-chat", 0, 0)).toBe(0);
    expect(estimateCostMilli("deepseek-chat", undefined, undefined)).toBe(0);
  });

  it("scales with token counts", () => {
    const small = estimateCostMilli("deepseek-chat", 1000, 1000);
    const big = estimateCostMilli("deepseek-chat", 100000, 100000);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(0);
  });

  it("keeps a typical small task countable (does not round to 0)", () => {
    // ~2000 in / 500 out was the case that rounded to 0 in 分; in 厘 it survives.
    expect(estimateCostMilli("deepseek-chat", 2000, 500)).toBeGreaterThan(0);
  });

  it("falls back to a default rate for unknown models", () => {
    expect(estimateCostMilli("mystery-model", 100000, 100000)).toBeGreaterThan(
      0,
    );
  });

  it("matches deepseek by substring (provider prefixes)", () => {
    expect(estimateCostMilli("deepseek-chat", 100000, 0)).toBe(
      estimateCostMilli("xx/deepseek-chat", 100000, 0),
    );
  });
});
