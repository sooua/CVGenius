import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { aiTasks } from "@/db/schema/aiTasks";
import { users } from "@/db/schema/users";
import { isPaidPlan } from "@/config/plans";

export const AI_QUOTAS = {
  rewrite: 30,
  checkup: 5,
  upload: 3,
  // Free trials for what used to be hard Pro-locked — let people taste the
  // value before paying. Pro is unlimited.
  match: 2,
  coverLetter: 2,
} as const;

export type AiTaskKind = keyof typeof AI_QUOTAS;

export type AiUsage = {
  rewriteUsed: number;
  checkupUsed: number;
  uploadUsed: number;
  matchUsed: number;
  coverLetterUsed: number;
};

export type AiQuotaSnapshot = AiUsage & {
  rewriteLimit: number;
  checkupLimit: number;
  uploadLimit: number;
  matchLimit: number;
  coverLetterLimit: number;
  plan: string;
  /** true when quota enforcement is off (paid tiers). */
  unlimited: boolean;
};

const kindToColumn: Record<AiTaskKind, string> = {
  rewrite: "rewrite_block",
  checkup: "checkup",
  upload: "parse_upload",
  match: "match_score",
  coverLetter: "cover_letter",
};

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

type UsageRow = { taskType: string; status: string };

/** Pure tally so the count logic is shared between read + reserve paths. */
function tallyUsage(rows: UsageRow[]): AiUsage {
  const usage: AiUsage = {
    rewriteUsed: 0,
    checkupUsed: 0,
    uploadUsed: 0,
    matchUsed: 0,
    coverLetterUsed: 0,
  };
  for (const r of rows) {
    if (r.status === "failed") continue; // failed attempts don't count
    if (r.taskType === kindToColumn.rewrite) usage.rewriteUsed += 1;
    else if (r.taskType === kindToColumn.checkup) usage.checkupUsed += 1;
    else if (r.taskType === kindToColumn.upload) usage.uploadUsed += 1;
    else if (r.taskType === kindToColumn.match) usage.matchUsed += 1;
    else if (r.taskType === kindToColumn.coverLetter)
      usage.coverLetterUsed += 1;
  }
  return usage;
}

export async function getMonthlyAiUsage(userId: string): Promise<AiUsage> {
  const rows = await db.query.aiTasks.findMany({
    where: and(
      eq(aiTasks.userId, userId),
      gte(aiTasks.createdAt, startOfMonth()),
    ),
    columns: { taskType: true, status: true },
  });
  return tallyUsage(rows);
}

export async function getAiQuotaSnapshot(
  userId: string,
): Promise<AiQuotaSnapshot> {
  const [usage, user] = await Promise.all([
    getMonthlyAiUsage(userId),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { plan: true },
    }),
  ]);
  const plan = user?.plan ?? "free";
  return {
    ...usage,
    rewriteLimit: AI_QUOTAS.rewrite,
    checkupLimit: AI_QUOTAS.checkup,
    uploadLimit: AI_QUOTAS.upload,
    matchLimit: AI_QUOTAS.match,
    coverLetterLimit: AI_QUOTAS.coverLetter,
    plan,
    unlimited: isPaidPlan(plan),
  };
}

const quotaLabel: Record<AiTaskKind, string> = {
  rewrite: "改写",
  checkup: "体检",
  upload: "PDF 解析",
  match: "岗位匹配",
  coverLetter: "求职信",
};

function usedFor(usage: AiUsage, kind: AiTaskKind): number {
  switch (kind) {
    case "rewrite":
      return usage.rewriteUsed;
    case "checkup":
      return usage.checkupUsed;
    case "upload":
      return usage.uploadUsed;
    case "match":
      return usage.matchUsed;
    case "coverLetter":
      return usage.coverLetterUsed;
  }
}

export function checkQuota(
  usage: AiUsage,
  kind: AiTaskKind,
  plan: string = "free",
): { ok: true } | { ok: false; error: string } {
  if (isPaidPlan(plan)) return { ok: true };

  const used = usedFor(usage, kind);
  const limit = AI_QUOTAS[kind];
  if (used >= limit) {
    return {
      ok: false,
      error: `本月 AI ${quotaLabel[kind]}已用完（${used} / ${limit}）。升级 Pro 立即解锁，或等下月 1 号重置。`,
    };
  }
  return { ok: true };
}

/** Convenience — fetches plan internally. Server actions reach for this. */
export async function getUserPlan(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  });
  return user?.plan ?? "free";
}

export type ReserveResult =
  | { ok: true; taskId: string }
  | { ok: false; error: string };

/**
 * Atomically checks quota and inserts the running ai_task row. A per-(user,
 * kind) transaction-scoped advisory lock serializes concurrent attempts, so
 * two requests can't both pass the check and overshoot the limit. The lock
 * releases on commit — by which point this attempt's row is visible to the
 * next one's count.
 */
export async function reserveAiTask(input: {
  userId: string;
  kind: AiTaskKind;
  plan: string;
  resumeId?: string | null;
  inputJson: unknown;
}): Promise<ReserveResult> {
  const taskType = kindToColumn[input.kind];
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`aiquota:${input.userId}:${input.kind}`}, 0))`,
    );

    if (!isPaidPlan(input.plan)) {
      const rows = await tx
        .select({ taskType: aiTasks.taskType, status: aiTasks.status })
        .from(aiTasks)
        .where(
          and(
            eq(aiTasks.userId, input.userId),
            gte(aiTasks.createdAt, startOfMonth()),
          ),
        );
      const check = checkQuota(tallyUsage(rows), input.kind, input.plan);
      if (!check.ok) return check;
    }

    const [task] = await tx
      .insert(aiTasks)
      .values({
        userId: input.userId,
        resumeId: input.resumeId ?? null,
        taskType,
        provider: "deepseek",
        model: "pending",
        inputJson: input.inputJson,
        status: "running",
      })
      .returning({ id: aiTasks.id });

    return { ok: true, taskId: task.id };
  });
}
