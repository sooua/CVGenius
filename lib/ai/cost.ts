/**
 * Rough AI cost estimation, written into ai_tasks.cost_cny_milli so spend is
 * visible (it was always null before). Rates are approximate CNY 厘 (milli-yuan,
 * 1/1000 元 = 1/10 分) per 1K tokens. We store 厘 rather than 分 because a single
 * small task costs a fraction of a 分 and would round to 0 — 厘 keeps that spend
 * countable while still being an integer column. This is an estimate, not a bill;
 * adjust as provider pricing changes. Pure + dependency-free so it's unit-testable.
 */
type Rate = { in: number; out: number }; // CNY 厘 (1/1000 元) per 1K tokens

const RATES: Record<string, Rate> = {
  // DeepSeek deepseek-chat (approx): ¥0.001/1K in, ¥0.002/1K out → 厘
  "deepseek-chat": { in: 1, out: 2 },
  // Qwen (approx) — matched by substring so qwen3-*/qwen-vl-* all resolve.
  qwen: { in: 2, out: 6 },
};
const DEFAULT_RATE: Rate = { in: 1, out: 2 };

/** Estimated cost in CNY 厘 (milli-yuan, 1/1000 元). */
export function estimateCostMilli(
  model: string | undefined,
  tokensIn: number | undefined,
  tokensOut: number | undefined,
): number {
  const rate =
    (model &&
      Object.entries(RATES).find(([k]) => model.includes(k))?.[1]) ||
    DEFAULT_RATE;
  const milli =
    ((tokensIn ?? 0) / 1000) * rate.in + ((tokensOut ?? 0) / 1000) * rate.out;
  return Math.round(milli);
}
