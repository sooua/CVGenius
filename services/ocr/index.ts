import "server-only";

import { env } from "@/lib/env.server";
import { qwenVisionOcr } from "./qwenVision";
import type { OcrProvider } from "./types";

export * from "./types";

/**
 * Returns the active OCR provider, or null if none is configured. Swap or add
 * providers here (Baidu/Tencent/Google Vision) without touching callers.
 */
export function resolveOcrProvider(): OcrProvider | null {
  if (env.QWEN_API_KEY) return qwenVisionOcr;
  return null;
}
