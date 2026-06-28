import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { env } from "@/lib/env.server";
import { withAiRetry } from "@/services/ai/call";
import type { OcrInput, OcrProvider } from "./types";

/**
 * OCR via Qwen-VL through DashScope's OpenAI-compatible endpoint. Reuses the
 * existing QWEN_API_KEY — no separate OCR account. Strong on Chinese.
 */
const qwen = env.QWEN_API_KEY
  ? createOpenAICompatible({
      name: "qwen",
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: env.QWEN_API_KEY,
    })
  : null;

const OCR_PROMPT =
  "这是一张简历的图片。请提取图片里的所有文字，按从上到下、从左到右的阅读顺序输出纯文本。" +
  "保留原始的分段和换行，保留数字、邮箱、链接、技术栈等专有名词。不要翻译、不要总结、不要添加任何解释。";

export const qwenVisionOcr: OcrProvider = {
  id: "qwen-vl",
  async recognize(input: OcrInput): Promise<{ text: string }> {
    if (!qwen) throw new Error("OCR 未配置（缺少 QWEN_API_KEY）");

    const result = await withAiRetry(
      (abortSignal) =>
        generateText({
          model: qwen("qwen-vl-max"),
          abortSignal,
          maxRetries: 0,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: OCR_PROMPT },
                {
                  type: "image",
                  image: input.bytes,
                  mediaType: input.mimeType,
                },
              ],
            },
          ],
        }),
      { timeoutMs: 90_000 },
    );

    return { text: result.text.trim() };
  },
};
