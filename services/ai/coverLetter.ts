import { generateText } from "ai";
import { pickModel } from "./provider";
import { withAiRetry } from "./call";

interface CoverLetterInput {
  resumeJson: unknown;
  /** Optional job description. If present, tailor to it. */
  jobDescription?: string;
  /** Optional free-form extra context — company name, hiring manager, why. */
  extra?: string;
}

export interface CoverLetterRunResult {
  text: string;
  modelId: string;
  tokensInput?: number;
  tokensOutput?: number;
}

const SYSTEM_PROMPT = `你是一位资深的求职顾问，替应届生写求职信（cover letter）。

要求：
1. 中文 · 整封信控制在 280-420 字（一页打印纸的密度）
2. 语气：温和、职业、自信——绝不油腻，绝不客套过头
3. 结构（不要写小标题）：
   - 一句开场指向应聘岗位 + 为什么是我
   - 两段主体：各挑 1 个最能打动 HR 的经历，把数字和成果说出来
   - 一段收尾：表达面试意愿 + 感谢
   - 落款用简历里的 basicInfo.name；如果没有，留占位「[你的名字]」
4. 绝不虚构事实。简历里没写的公司、项目、技能，一律不编
5. 如果有 JD：抽取 JD 里最关键的 2-3 个诉求，在信中自然呼应
6. 如果没有 JD：按简历的 targetRole 写一封通用信，不提具体公司

输出纯文本（换行用空行分段），不要 markdown、不要 HTML、不要解释性语句。`;

export async function runCoverLetter(
  input: CoverLetterInput,
): Promise<CoverLetterRunResult> {
  const parts: string[] = [];
  if (input.jobDescription?.trim()) {
    parts.push(`岗位描述（JD）：\n${input.jobDescription.trim().slice(0, 4000)}`);
  }
  if (input.extra?.trim()) {
    parts.push(`补充说明：\n${input.extra.trim().slice(0, 800)}`);
  }
  parts.push(`简历结构化内容：\n${JSON.stringify(input.resumeJson, null, 2)}`);

  const result = await withAiRetry((abortSignal) =>
    generateText({
      model: pickModel("quality"),
      system: SYSTEM_PROMPT,
      prompt: parts.join("\n\n"),
      temperature: 0.55,
      abortSignal,
      maxRetries: 0,
    }),
  );

  return {
    text: result.text.trim(),
    modelId: result.response.modelId,
    tokensInput: result.usage.inputTokens,
    tokensOutput: result.usage.outputTokens,
  };
}
