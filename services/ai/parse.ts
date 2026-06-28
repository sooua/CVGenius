import { generateObject } from "ai";
import { pickModel } from "./provider";
import { withAiRetry } from "./call";
import {
  resumeContentSchema,
  type ResumeContent,
} from "@/lib/resume/schema";

export interface ParseRunResult {
  content: ResumeContent;
  modelId: string;
  tokensInput?: number;
  tokensOutput?: number;
}

const SYSTEM_PROMPT = `你是一位简历解析助手。用户上传了一份 PDF 简历，下面是从 PDF 提取出的原始文本（可能有换行错乱、排版噪声）。

你的任务：把这些文字抽取成结构化 JSON，按 schema 填字段。

硬规则：
1. 绝对不要虚构任何事实。原文没有的信息对应字段留空字符串或空数组。
2. 对每段经历推断 kind：教育相关 → "education"；实习 / 全职 / 工作 → "internship"；其它（课程项目、比赛、社团） → "project"。
3. 日期保留原文格式（例如 "2024.09" 或 "2024 - 2025"），不要擅自翻译成其它格式。
4. highlights 每条是原文中一个 bullet / 一句话的职业描述；保留数字、技术栈、项目名称。
5. 技能按类别合并；如果原文没有分类，放进 "其他"。
6. targetRole 字段只在原文明确写了"求职目标 / 应聘岗位 / Objective"这类关键词时才填；否则留空字符串。
7. summary（个人简介）如果原文有"关于我 / 简介 / Personal Statement"类内容，抽取；否则留空字符串。

输出必须严格符合提供的 JSON schema。`;

export async function parseResumeFromText(
  rawText: string,
): Promise<ParseRunResult> {
  const clean = rawText.trim();
  if (!clean) {
    throw new Error("PDF 内容为空，无法解析");
  }

  const result = await withAiRetry((abortSignal) =>
    generateObject({
      model: pickModel("quality"),
      schema: resumeContentSchema,
      system: SYSTEM_PROMPT,
      prompt: `简历原文：\n\n${clean.slice(0, 12000)}`,
      temperature: 0.2,
      abortSignal,
      maxRetries: 0,
    }),
  );

  return {
    content: result.object,
    modelId: result.response.modelId,
    tokensInput: result.usage.inputTokens,
    tokensOutput: result.usage.outputTokens,
  };
}
