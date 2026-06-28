import { describe, expect, it } from "vitest";
import { estimateCostCents } from "./cost";

describe("estimateCostCents", () => {
  it("is zero when there are no tokens", () => {
    expect(estimateCostCents("deepseek-chat", 0, 0)).toBe(0);
    expect(estimateCostCents("deepseek-chat", undefined, undefined)).toBe(0);
  });

  it("scales with token counts", () => {
    const small = estimateCostCents("deepseek-chat", 1000, 1000);
    const big = estimateCostCents("deepseek-chat", 100000, 100000);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(0);
  });

  it("falls back to a default rate for unknown models", () => {
    expect(estimateCostCents("mystery-model", 100000, 100000)).toBeGreaterThan(
      0,
    );
  });

  it("matches deepseek by substring (provider prefixes)", () => {
    expect(estimateCostCents("deepseek-chat", 100000, 0)).toBe(
      estimateCostCents("xx/deepseek-chat", 100000, 0),
    );
  });
});
