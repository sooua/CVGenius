"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aiTasks } from "@/db/schema/aiTasks";
import { resumes } from "@/db/schema/resumes";
import { verifySession } from "@/lib/auth/dal";
import { parseResumeContent } from "@/lib/resume/schema";
import { getUserPlan, reserveAiTask } from "@/lib/ai/quota";
import { estimateCostMilli } from "@/lib/ai/cost";
import { rewriteBlock } from "@/services/ai/rewrite";
import { expandHighlights } from "@/services/ai/expand";
import { runCheckup } from "@/services/ai/checkup";
import { runJobMatch } from "@/services/ai/match";
import { runCoverLetter } from "@/services/ai/coverLetter";
import { runInterviewPrep } from "@/services/ai/interview";
import { translateResumeToEnglish } from "@/services/ai/translate";
import { isPaidPlan } from "@/config/plans";
import { resumeContentSchema } from "@/lib/resume/schema";
import type { ResumeContent } from "@/lib/resume/schema";
import { interviewPrepResultSchema } from "@/services/ai/schemas";
import type {
  CheckupResult,
  InterviewPrepResult,
  MatchResult,
  RewriteBlock,
} from "@/services/ai/schemas";

export type RewriteResponse =
  | { ok: true; result: RewriteBlock; taskId: string }
  | { ok: false; error: string };

export async function rewriteHighlight(input: {
  resumeId: string;
  text: string;
  context?: Record<string, string>;
}): Promise<RewriteResponse> {
  if (!input.text.trim()) {
    return { ok: false, error: "原文为空，无法改写" };
  }

  const { userId } = await verifySession();

  const resume = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, input.resumeId), eq(resumes.userId, userId)),
  });
  if (!resume) {
    return { ok: false, error: "简历不存在或无权访问" };
  }

  const plan = await getUserPlan(userId);
  const content = parseResumeContent(resume.currentVersionJson);
  const jobCategory = content.targetRole || "通用";

  const reserved = await reserveAiTask({
    userId,
    kind: "rewrite",
    plan,
    resumeId: input.resumeId,
    inputJson: {
      jobCategory,
      original: input.text,
      context: input.context ?? {},
    },
  });
  if (!reserved.ok) {
    return { ok: false, error: reserved.error };
  }
  const task = { id: reserved.taskId };

  try {
    const result = await rewriteBlock({
      jobCategory,
      original: input.text,
      context: input.context,
    });

    await db
      .update(aiTasks)
      .set({
        status: "success",
        model: result.modelId,
        outputJson: result.block,
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        costCnyMilli: estimateCostMilli(
          result.modelId,
          result.tokensInput,
          result.tokensOutput,
        ),
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));

    return { ok: true, result: result.block, taskId: task.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 调用失败";
    await db
      .update(aiTasks)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));

    return { ok: false, error: message };
  }
}

export type CheckupResponse =
  | { ok: true; result: CheckupResult; taskId: string }
  | { ok: false; error: string };

export async function runResumeCheckup(
  resumeId: string,
): Promise<CheckupResponse> {
  const { userId } = await verifySession();

  const resume = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
  });
  if (!resume) {
    return { ok: false, error: "简历不存在或无权访问" };
  }

  const plan = await getUserPlan(userId);
  const content = parseResumeContent(resume.currentVersionJson);
  const jobCategory = content.targetRole || "通用";

  const reserved = await reserveAiTask({
    userId,
    kind: "checkup",
    plan,
    resumeId,
    inputJson: { jobCategory, resumeContent: content },
  });
  if (!reserved.ok) {
    return { ok: false, error: reserved.error };
  }
  const task = { id: reserved.taskId };

  try {
    const run = await runCheckup({ jobCategory, resumeJson: content });

    await db
      .update(aiTasks)
      .set({
        status: "success",
        model: run.modelId,
        outputJson: run.result,
        tokensInput: run.tokensInput,
        tokensOutput: run.tokensOutput,
        costCnyMilli: estimateCostMilli(
          run.modelId,
          run.tokensInput,
          run.tokensOutput,
        ),
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));

    return { ok: true, result: run.result, taskId: task.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 调用失败";
    await db
      .update(aiTasks)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));
    return { ok: false, error: message };
  }
}

export type MatchResponse =
  | { ok: true; result: MatchResult; taskId: string }
  | { ok: false; error: string; requiresUpgrade?: boolean };

export async function runResumeMatch(input: {
  resumeId: string;
  jobDescription: string;
}): Promise<MatchResponse> {
  const jd = input.jobDescription.trim();
  if (jd.length < 40) {
    return { ok: false, error: "岗位描述太短，贴整段 JD 效果最好" };
  }

  const { userId } = await verifySession();

  const resume = await db.query.resumes.findFirst({
    where: and(
      eq(resumes.id, input.resumeId),
      eq(resumes.userId, userId),
    ),
  });
  if (!resume) {
    return { ok: false, error: "简历不存在或无权访问" };
  }

  const plan = await getUserPlan(userId);
  const content = parseResumeContent(resume.currentVersionJson);

  const reserved = await reserveAiTask({
    userId,
    kind: "match",
    plan,
    resumeId: input.resumeId,
    inputJson: { jobDescription: jd.slice(0, 2000), resumeContent: content },
  });
  if (!reserved.ok) {
    return {
      ok: false,
      error: reserved.error,
      requiresUpgrade: !isPaidPlan(plan),
    };
  }
  const task = { id: reserved.taskId };

  try {
    const run = await runJobMatch({ jobDescription: jd, resumeJson: content });

    await db
      .update(aiTasks)
      .set({
        status: "success",
        model: run.modelId,
        outputJson: run.result,
        tokensInput: run.tokensInput,
        tokensOutput: run.tokensOutput,
        costCnyMilli: estimateCostMilli(
          run.modelId,
          run.tokensInput,
          run.tokensOutput,
        ),
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));

    return { ok: true, result: run.result, taskId: task.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 匹配失败";
    await db
      .update(aiTasks)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));
    return { ok: false, error: message };
  }
}

export type CoverLetterResponse =
  | { ok: true; text: string; taskId: string }
  | { ok: false; error: string; requiresUpgrade?: boolean };

export async function generateCoverLetter(input: {
  resumeId: string;
  jobDescription?: string;
  extra?: string;
}): Promise<CoverLetterResponse> {
  const { userId } = await verifySession();

  const resume = await db.query.resumes.findFirst({
    where: and(
      eq(resumes.id, input.resumeId),
      eq(resumes.userId, userId),
    ),
  });
  if (!resume) {
    return { ok: false, error: "简历不存在或无权访问" };
  }

  const plan = await getUserPlan(userId);
  const content = parseResumeContent(resume.currentVersionJson);

  const reserved = await reserveAiTask({
    userId,
    kind: "coverLetter",
    plan,
    resumeId: input.resumeId,
    inputJson: {
      resumeContent: content,
      jobDescription: input.jobDescription?.slice(0, 2000),
      extra: input.extra?.slice(0, 500),
    },
  });
  if (!reserved.ok) {
    return {
      ok: false,
      error: reserved.error,
      requiresUpgrade: !isPaidPlan(plan),
    };
  }
  const task = { id: reserved.taskId };

  try {
    const run = await runCoverLetter({
      resumeJson: content,
      jobDescription: input.jobDescription,
      extra: input.extra,
    });

    await db
      .update(aiTasks)
      .set({
        status: "success",
        model: run.modelId,
        outputJson: { text: run.text },
        tokensInput: run.tokensInput,
        tokensOutput: run.tokensOutput,
        costCnyMilli: estimateCostMilli(
          run.modelId,
          run.tokensInput,
          run.tokensOutput,
        ),
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));

    return { ok: true, text: run.text, taskId: task.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "求职信生成失败";
    await db
      .update(aiTasks)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));
    return { ok: false, error: message };
  }
}

export type AiHistoryItem =
  | { id: string; kind: "cover"; at: string; text: string }
  | {
      id: string;
      kind: "interview";
      at: string;
      questions: InterviewPrepResult["questions"];
    };

/** Past AI generations worth revisiting (cover letters + interview prep). */
export async function listResumeAiHistory(
  resumeId: string,
): Promise<AiHistoryItem[]> {
  const { userId } = await verifySession();
  const rows = await db.query.aiTasks.findMany({
    where: and(
      eq(aiTasks.userId, userId),
      eq(aiTasks.resumeId, resumeId),
      eq(aiTasks.status, "success"),
    ),
    orderBy: [desc(aiTasks.createdAt)],
    limit: 40,
  });

  const items: AiHistoryItem[] = [];
  for (const r of rows) {
    if (items.length >= 12) break;
    if (r.taskType === "cover_letter") {
      const text = (r.outputJson as { text?: unknown } | null)?.text;
      if (typeof text === "string" && text.trim()) {
        items.push({
          id: r.id,
          kind: "cover",
          at: r.createdAt.toISOString(),
          text,
        });
      }
    } else if (r.taskType === "interview_prep") {
      const parsed = interviewPrepResultSchema.safeParse(r.outputJson);
      if (parsed.success) {
        items.push({
          id: r.id,
          kind: "interview",
          at: r.createdAt.toISOString(),
          questions: parsed.data.questions,
        });
      }
    }
  }
  return items;
}

export type ExpandResponse =
  | { ok: true; highlights: string[]; taskId: string }
  | { ok: false; error: string };

export async function generateHighlights(input: {
  resumeId: string;
  description: string;
  context?: Record<string, string>;
}): Promise<ExpandResponse> {
  if (!input.description.trim()) {
    return { ok: false, error: "先用一句话写下你做了什么" };
  }

  const { userId } = await verifySession();

  const resume = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, input.resumeId), eq(resumes.userId, userId)),
  });
  if (!resume) {
    return { ok: false, error: "简历不存在或无权访问" };
  }

  const plan = await getUserPlan(userId);
  const content = parseResumeContent(resume.currentVersionJson);
  const jobCategory = content.targetRole || "通用";

  // Generation shares the "rewrite" quota bucket — same "produce bullet text"
  // category, no separate limit to reason about.
  const reserved = await reserveAiTask({
    userId,
    kind: "rewrite",
    plan,
    resumeId: input.resumeId,
    inputJson: { description: input.description, context: input.context ?? {} },
  });
  if (!reserved.ok) {
    return { ok: false, error: reserved.error };
  }
  const task = { id: reserved.taskId };

  try {
    const run = await expandHighlights({
      jobCategory,
      description: input.description,
      context: input.context,
    });

    await db
      .update(aiTasks)
      .set({
        status: "success",
        model: run.modelId,
        outputJson: run.result,
        tokensInput: run.tokensInput,
        tokensOutput: run.tokensOutput,
        costCnyMilli: estimateCostMilli(
          run.modelId,
          run.tokensInput,
          run.tokensOutput,
        ),
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));

    return { ok: true, highlights: run.result.highlights, taskId: task.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 生成失败";
    await db
      .update(aiTasks)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(aiTasks.id, task.id));
    return { ok: false, error: message };
  }
}

export type InterviewResponse =
  | { ok: true; result: InterviewPrepResult; taskId: string }
  | { ok: false; error: string; requiresUpgrade?: boolean };

export async function generateInterviewPrep(input: {
  resumeId: string;
  jobDescription?: string;
}): Promise<InterviewResponse> {
  const { userId } = await verifySession();

  const resume = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, input.resumeId), eq(resumes.userId, userId)),
  });
  if (!resume) {
    return { ok: false, error: "简历不存在或无权访问" };
  }

  const plan = await getUserPlan(userId);
  const content = parseResumeContent(resume.currentVersionJson);
  const jobCategory = content.targetRole || "通用";

  const reserved = await reserveAiTask({
    userId,
    kind: "interview",
    plan,
    resumeId: input.resumeId,
    inputJson: { jobDescription: input.jobDescription?.slice(0, 2000) },
  });
  if (!reserved.ok) {
    return {
      ok: false,
      error: reserved.error,
      requiresUpgrade: !isPaidPlan(plan),
    };
  }
  const task = { id: reserved.taskId };

  try {
    const run = await runInterviewPrep({
      jobCategory,
      resumeJson: content,
      jobDescription: input.jobDescription,
    });

    await db
      .update(aiTasks)
      .set({
        status: "success",
        model: run.modelId,
        outputJson: run.result,
        tokensInput: run.tokensInput,
        tokensOutput: run.tokensOutput,
        costCnyMilli: estimateCostMilli(
          run.modelId,
          run.tokensInput,
          run.tokensOutput,
        ),
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));

    return { ok: true, result: run.result, taskId: task.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "面试预测失败";
    await db
      .update(aiTasks)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(aiTasks.id, task.id));
    return { ok: false, error: message };
  }
}

/**
 * Returns an English-translated copy of the resume content, cached in
 * ai_tasks. Non-action helper used by the PDF route — not marked "use server"
 * callable from a client, kept in-file because it shares the task-logging idiom.
 */
export async function getOrGenerateEnglishVersion(input: {
  resumeId: string;
  userId: string;
}): Promise<
  | { ok: true; content: ResumeContent }
  | { ok: false; error: string; requiresUpgrade?: boolean }
> {
  const plan = await getUserPlan(input.userId);
  if (!isPaidPlan(plan)) {
    return {
      ok: false,
      error: "英文 PDF 是 Pro 功能",
      requiresUpgrade: true,
    };
  }

  const resume = await db.query.resumes.findFirst({
    where: and(
      eq(resumes.id, input.resumeId),
      eq(resumes.userId, input.userId),
    ),
  });
  if (!resume) return { ok: false, error: "简历不存在或无权访问" };

  // Look for the most recent cached translation.
  const cached = await db.query.aiTasks.findFirst({
    where: and(
      eq(aiTasks.resumeId, input.resumeId),
      eq(aiTasks.taskType, "translate_resume"),
      eq(aiTasks.status, "success"),
    ),
    orderBy: [desc(aiTasks.createdAt)],
  });
  if (cached && cached.createdAt >= resume.updatedAt) {
    const parsed = resumeContentSchema.safeParse(cached.outputJson);
    if (parsed.success) {
      return { ok: true, content: parsed.data };
    }
  }

  const content = parseResumeContent(resume.currentVersionJson);
  const [task] = await db
    .insert(aiTasks)
    .values({
      userId: input.userId,
      resumeId: input.resumeId,
      taskType: "translate_resume",
      provider: "deepseek",
      model: "pending",
      inputJson: { resumeContent: content },
      status: "running",
    })
    .returning({ id: aiTasks.id });

  try {
    const run = await translateResumeToEnglish(content);
    await db
      .update(aiTasks)
      .set({
        status: "success",
        model: run.modelId,
        outputJson: run.content,
        tokensInput: run.tokensInput,
        tokensOutput: run.tokensOutput,
        costCnyMilli: estimateCostMilli(
          run.modelId,
          run.tokensInput,
          run.tokensOutput,
        ),
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));
    return { ok: true, content: run.content };
  } catch (err) {
    const message = err instanceof Error ? err.message : "翻译失败";
    await db
      .update(aiTasks)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));
    return { ok: false, error: message };
  }
}
