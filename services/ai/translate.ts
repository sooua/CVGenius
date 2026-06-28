import { generateObject } from "ai";
import { pickModel } from "./provider";
import { withAiRetry } from "./call";
import {
  resumeContentSchema,
  type ResumeContent,
} from "@/lib/resume/schema";

export interface TranslateRunResult {
  content: ResumeContent;
  modelId: string;
  tokensInput?: number;
  tokensOutput?: number;
}

const SYSTEM_PROMPT = `你在把一份中文简历翻译成英文，供英语招聘方阅读。

硬规则：
1. 保持下列字段原样不动：id、kind、email、phone、portfolioUrl、github、linkedin、startDate、endDate
2. 姓名（basicInfo.name）：用标准汉语拼音罗马化，姓在前名在后首字母大写（"夏禾壮" → "Xia Hezhuang"）
3. targetRole / headline / summary / experience.title / org / role / location / highlights / skill category / skill items / award title / award issuer / certification / language name 字段：自然、专业地翻译成英文。语言水平（language.level）里的考试名和分数（CET-6、IELTS 7.0、N2 等）保留原样，只翻译描述性文字
4. 翻译时：
   - 绝不虚构事实，数字和专有名词（公司、学校、技术栈、CVE 号、奖项名）保留原样或用国际通用写法
   - 去除中式英文——用母语者会用的表达；用 result-driven 风格，避免冗余修饰
   - 动词用过去式或现在分词保持一致；简历英文通常用过去时 + 动作开头
5. skills.items 里的技术栈名称保留（React 还是 React、Burp Suite 还是 Burp Suite）
6. 如果某段内容在英语语境下更适合用专业缩写，合理使用（如"中央处理器" → "CPU"）

输出必须严格符合 resumeContentSchema。不添加字段也不漏字段。`;

export async function translateResumeToEnglish(
  content: ResumeContent,
): Promise<TranslateRunResult> {
  const result = await withAiRetry((abortSignal) =>
    generateObject({
      model: pickModel("quality"),
      schema: resumeContentSchema,
      system: SYSTEM_PROMPT,
      prompt: `中文简历（JSON）：\n${JSON.stringify(content, null, 2)}`,
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
