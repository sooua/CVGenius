import "server-only";

import { APICallError, NoObjectGeneratedError } from "ai";

/**
 * Central resilience wrapper for every AI call. Without this, a slow or
 * flaky model leaves the user staring at a spinner with no timeout and no
 * retry. Each attempt gets its own AbortSignal.timeout; transient failures
 * (timeouts, 429/5xx, network blips, unparseable output) are retried with
 * exponential backoff. The thrown message is user-facing — actions surface
 * it straight to the UI.
 */
export const AI_TIMEOUT_MS = 60_000;
const DEFAULT_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 600;

function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError")
  );
}

function isRetriable(err: unknown): boolean {
  if (isTimeoutError(err)) return true;
  // Model produced output that didn't parse/validate — a fresh attempt often
  // succeeds.
  if (NoObjectGeneratedError.isInstance(err)) return true;
  if (APICallError.isInstance(err)) {
    if (typeof err.isRetryable === "boolean") return err.isRetryable;
    const s = err.statusCode;
    return s === 408 || s === 409 || s === 429 || (s != null && s >= 500);
  }
  // Bare network errors (undici) carry no status but are transient.
  return (
    err instanceof Error &&
    /fetch failed|terminated|network|socket|ECONN|EAI_AGAIN/i.test(err.message)
  );
}

function friendlyMessage(err: unknown): string {
  if (isTimeoutError(err)) {
    return "AI 响应超时了，请稍后再试一次。";
  }
  if (
    APICallError.isInstance(err) &&
    (err.statusCode === 429 || err.statusCode === 503)
  ) {
    return "AI 服务当前繁忙，请过一会儿再试。";
  }
  if (NoObjectGeneratedError.isInstance(err)) {
    return "AI 返回的内容没能解析成功，请再试一次。";
  }
  return err instanceof Error && err.message ? err.message : "AI 调用失败";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withAiRetry<T>(
  run: (signal: AbortSignal) => Promise<T>,
  opts: { timeoutMs?: number; attempts?: number } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? AI_TIMEOUT_MS;
  const attempts = opts.attempts ?? DEFAULT_ATTEMPTS;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await run(AbortSignal.timeout(timeoutMs));
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts || !isRetriable(err)) {
        throw new Error(friendlyMessage(err));
      }
      // Exponential backoff; the +attempt term spreads retries a little.
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1) + attempt * 120);
    }
  }
  throw new Error(friendlyMessage(lastErr));
}
