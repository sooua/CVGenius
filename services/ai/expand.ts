import { generateObject } from "ai";
import { pickModel } from "./provider";
import { withAiRetry } from "./call";
import { expandResultSchema, type ExpandResult } from "./schemas";

interface ExpandInput {
  jobCategory: string;
  /** One-line description of what the user did, in plain words. */
  description: string;
  /** Context like experience title, org, role. */
  context?: Record<string, string>;
}

export interface ExpandRunResult {
  result: ExpandResult;
  modelId: string;
  tokensInput?: number;
  tokensOutput?: number;
}

const SYSTEM_PROMPT = `你在帮一位应届生把"我做了什么"的大白话，扩写成简历里能直接用的 2-3 条经历亮点（bullet）。

规则（严格遵守）：
1. 只基于用户给的描述扩写，绝不虚构数字、技术栈、公司、职责。用户没给的量化结果，不要编造，可以用更具体的动作动词把过程说清楚。
2. 每条用动词开头（主导 / 独立完成 / 搭建 / 优化 / 推动 / 梳理…），突出"做了什么 + 怎么做 + 带来什么"。
3. 如果用户的描述里有数字（人数、性能、规模、时长），一定保留并放在合适位置。
4. 贴合目标岗位方向的关键能力，但不要硬塞无关关键词。
5. 每条一句话，简洁、专业、不啰嗦，不要 markdown 符号、不要序号。

输出 JSON：highlights（2-3 条字符串）。`;

export async function expandHighlights(
  input: ExpandInput,
): Promise<ExpandRunResult> {
  const userPrompt = [
    `目标岗位方向：${input.jobCategory || "通用"}`,
    input.context
      ? `这段经历的背景：\n${Object.entries(input.context)
          .filter(([, v]) => v)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : "",
    "",
    "用户的大白话描述：",
    input.description,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await withAiRetry((abortSignal) =>
    generateObject({
      model: pickModel("quality"),
      schema: expandResultSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.5,
      abortSignal,
      maxRetries: 0,
    }),
  );

  return {
    result: result.object,
    modelId: result.response.modelId,
    tokensInput: result.usage.inputTokens,
    tokensOutput: result.usage.outputTokens,
  };
}
