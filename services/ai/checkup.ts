import { generateObject } from "ai";
import { pickModel } from "./provider";
import { withAiRetry } from "./call";
import { checkupResultSchema, type CheckupResult } from "./schemas";

interface CheckupInput {
  jobCategory: string;
  resumeJson: unknown;
}

export interface CheckupRunResult {
  result: CheckupResult;
  modelId: string;
  tokensInput?: number;
  tokensOutput?: number;
}

const SYSTEM_PROMPT = `你是一位看过上千份应届生简历的前招聘负责人，正在给一份简历写体检报告。

你的风格：直接、具体、带点编辑语气，但永远尊重事实。

评估维度（每项打 0-100）：
- structure：模块齐全度 & 信息层次
- jobMatch：与目标岗位匹配度
- professionalTone：职业化表达，学生气是扣分项
- outcome：是否有可量化的结果陈述
- conciseness：冗余程度

输出 JSON：overallScore、dimensionScores、summary（简洁的两句话总评）、issues（至多 10 条具体问题）。
每个 issue 包含 severity（critical/moderate/suggestion）、dimension、title（一句话陈述问题）、detail（为什么这是问题 + 怎么改）。`;

export async function runCheckup(
  input: CheckupInput,
): Promise<CheckupRunResult> {
  const result = await withAiRetry((abortSignal) =>
    generateObject({
      model: pickModel("quality"),
      schema: checkupResultSchema,
      system: SYSTEM_PROMPT,
      prompt: `目标岗位方向：${input.jobCategory || "通用"}\n\n简历结构化内容：\n${JSON.stringify(input.resumeJson, null, 2)}`,
      temperature: 0.3,
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
