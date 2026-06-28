import { generateObject } from "ai";
import { pickModel } from "./provider";
import { withAiRetry } from "./call";
import {
  interviewPrepResultSchema,
  type InterviewPrepResult,
} from "./schemas";

interface InterviewInput {
  jobCategory: string;
  resumeJson: unknown;
  /** Optional job description to tailor the questions to. */
  jobDescription?: string;
}

export interface InterviewRunResult {
  result: InterviewPrepResult;
  modelId: string;
  tokensInput?: number;
  tokensOutput?: number;
}

const SYSTEM_PROMPT = `你是一位资深的招聘面试官，正在根据一份应届生简历，预测对方很可能被问到的面试问题，帮 ta 提前准备。

任务：
1. 通读简历，挑出最值得深挖的经历、技能、和潜在疑点。
2. 给出 6-10 个高质量问题，覆盖四类（category）：
   - behavioral：行为/软技能（团队协作、冲突、抗压…）
   - technical：与目标岗位相关的技术/专业知识
   - project：针对简历里具体项目/经历的追问（一定要引用简历里的真实内容）
   - fit：动机、职业规划、与岗位/公司的匹配
3. 每个问题给：
   - question：面试官会怎么问（口语化、具体）
   - probe：这个问题在考察什么（让候选人理解意图）
   - tip：怎么答更好——明确建议从简历里哪段经历切入、用什么结构（如 STAR）

硬规则：
- project 类问题必须基于简历里真实写到的内容，不要虚构。
- 如果给了 JD，technical 和 fit 类问题要贴合 JD 的核心要求。
- 问题要具体、能直接拿来练，不要泛泛而谈。

输出 JSON：questions 数组。`;

export async function runInterviewPrep(
  input: InterviewInput,
): Promise<InterviewRunResult> {
  const parts: string[] = [`目标岗位方向：${input.jobCategory || "通用"}`];
  if (input.jobDescription?.trim()) {
    parts.push(`岗位描述（JD）：\n${input.jobDescription.trim().slice(0, 4000)}`);
  }
  parts.push(
    `简历结构化内容：\n${JSON.stringify(input.resumeJson, null, 2)}`,
  );

  const result = await withAiRetry((abortSignal) =>
    generateObject({
      model: pickModel("quality"),
      schema: interviewPrepResultSchema,
      system: SYSTEM_PROMPT,
      prompt: parts.join("\n\n"),
      temperature: 0.4,
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
