/**
 * Rough AI cost estimation, written into ai_tasks.cost_cny_cents so spend is
 * visible (it was always null before). Rates are approximate CNY cents per
 * 1K tokens — adjust as provider pricing changes; this is an estimate, not a
 * bill. Pure + dependency-free so it's unit-testable.
 */
type Rate = { in: number; out: number }; // CNY cents per 1K tokens

const RATES: Record<string, Rate> = {
  // DeepSeek deepseek-chat (approx): ¥0.001/1K in, ¥0.002/1K out → cents
  "deepseek-chat": { in: 0.1, out: 0.2 },
  // Qwen (approx) — matched by substring so qwen3-*/qwen-vl-* all resolve.
  qwen: { in: 0.2, out: 0.6 },
};
const DEFAULT_RATE: Rate = { in: 0.1, out: 0.2 };

export function estimateCostCents(
  model: string | undefined,
  tokensIn: number | undefined,
  tokensOut: number | undefined,
): number {
  const rate =
    (model &&
      Object.entries(RATES).find(([k]) => model.includes(k))?.[1]) ||
    DEFAULT_RATE;
  const cents =
    ((tokensIn ?? 0) / 1000) * rate.in + ((tokensOut ?? 0) / 1000) * rate.out;
  return Math.round(cents);
}
