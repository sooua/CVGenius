import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { env } from "@/lib/env.server";

/**
 * CVGenius's AI providers are provider-agnostic: call pickModel() with a
 * task-tier hint and we return the right LanguageModel instance.
 *
 * Tiers:
 *   "fast"    — low-value tasks (keyword extraction, classification)
 *   "quality" — high-value tasks (full rewrite, checkup)
 */
type Tier = "fast" | "quality";

const deepseek = env.DEEPSEEK_API_KEY
  ? createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY })
  : null;

const qwen = env.QWEN_API_KEY
  ? createOpenAICompatible({
      name: "qwen",
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: env.QWEN_API_KEY,
    })
  : null;

export function pickModel(tier: Tier): LanguageModel {
  // Prefer DeepSeek when available (cheapest, good Chinese)
  if (deepseek) {
    return tier === "quality"
      ? deepseek("deepseek-chat")
      : deepseek("deepseek-chat");
  }

  // Fallback: Qwen via the OpenAI-compatible endpoint
  if (qwen) {
    return tier === "quality" ? qwen("qwen3-max") : qwen("qwen3-turbo");
  }

  throw new Error(
    "No AI provider configured. Set DEEPSEEK_API_KEY or QWEN_API_KEY.",
  );
}
