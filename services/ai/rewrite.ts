import { generateObject } from "ai";
import { pickModel } from "./provider";
import { withAiRetry } from "./call";
import { rewriteBlockSchema, type RewriteBlock } from "./schemas";

interface RewriteInput {
  /** Which job direction to optimise for (e.g. "frontend", "product"). */
  jobCategory: string;
  /** Raw text of the block the user wrote. */
  original: string;
  /** Optional context like project name, role, tech stack. */
  context?: Record<string, string>;
}

export interface RewriteResult {
  block: RewriteBlock;
  modelId: string;
  tokensInput?: number;
  tokensOutput?: number;
}

const SYSTEM_PROMPT = `你是一位资深的简历顾问，正在帮一位应届生或职场新人修改简历里的一段文字。

规则（严格遵守）：
1. 绝不捏造事实——只能调整已有事实的表达方式
2. 如果原文中缺少某类信息（例如具体数字），不要编造，而是在 reasons 中提示用户补充
3. 把"参加了 / 学习了 / 了解了"改为更主动的动作词（主导 / 独立完成 / 梳理 / 推动）
4. 保留原文中所有的技术栈、项目名称、时间、具体人数/数据
5. 目标岗位的关键能力应在改写中自然突出

输出结构化 JSON，字段：original（原文）、rewritten（改写）、reasons（3-5 条改动说明）、preservedFacts（你特意保留下来的事实）。`;

export async function rewriteBlock(
  input: RewriteInput,
): Promise<RewriteResult> {
  const userPrompt = [
    `目标岗位方向：${input.jobCategory || "通用"}`,
    input.context
      ? `上下文：\n${Object.entries(input.context)
          .filter(([, v]) => v)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : "",
    "",
    "原文：",
    input.original,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await withAiRetry((abortSignal) =>
    generateObject({
      model: pickModel("quality"),
      schema: rewriteBlockSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.4,
      abortSignal,
      maxRetries: 0,
    }),
  );

  return {
    block: result.object,
    modelId: result.response.modelId,
    tokensInput: result.usage.inputTokens,
    tokensOutput: result.usage.outputTokens,
  };
}
