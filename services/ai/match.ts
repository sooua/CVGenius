import { generateObject } from "ai";
import { pickModel } from "./provider";
import { withAiRetry } from "./call";
import { matchResultSchema, type MatchResult } from "./schemas";

interface MatchInput {
  jobDescription: string;
  resumeJson: unknown;
}

export interface MatchRunResult {
  result: MatchResult;
  modelId: string;
  tokensInput?: number;
  tokensOutput?: number;
}

const SYSTEM_PROMPT = `你在比较一份简历和一段岗位描述（JD），给出匹配度分析。

任务：
1. 从 JD 里提取核心要求（技能、经验、职责关键词）
2. 逐项核对简历里是否有对应证据（项目、经历、技能里提过）
3. 打 3 个维度分数（0-100）：skills（技能匹配）、experience（经历相关度）、tone（语气专业度）
4. 给出总分 overallScore（0-100），两三句话的 summary
5. matchedKeywords：在简历里能找到证据的 JD 关键词（最多 15）
6. missingKeywords：JD 要求但简历没体现的（最多 15）——这是用户最想看的
7. suggestions：针对 missingKeywords 的具体改进方向，最多 8 条。每条：
   - title（一句话说清问题，如「缺少性能优化相关经验」）
   - detail（为什么重要 + 建议从哪段经历里补）
   - 如果能直接给一条可加进简历的 highlight 句子，放 suggestedHighlight

硬规则：
- 不要捏造简历里没有的事实
- missingKeywords 要具体到词（如「React Query」「SSR」），不要宽泛概念
- suggestions 要可操作，不要废话`;

export async function runJobMatch(
  input: MatchInput,
): Promise<MatchRunResult> {
  const jd = input.jobDescription.trim();
  if (!jd) throw new Error("JD 为空");

  const result = await withAiRetry((abortSignal) =>
    generateObject({
      model: pickModel("quality"),
      schema: matchResultSchema,
      system: SYSTEM_PROMPT,
      prompt: `岗位描述（JD）：\n${jd.slice(0, 6000)}\n\n简历结构化内容：\n${JSON.stringify(input.resumeJson, null, 2)}`,
      temperature: 0.25,
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
