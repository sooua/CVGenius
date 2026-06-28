"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { jobTargets } from "@/db/schema/jobTargets";
import { verifySession } from "@/lib/auth/dal";
import { normalizeStatus } from "@/lib/applications";

export async function listJobTargets() {
  const { userId } = await verifySession();
  return db.query.jobTargets.findMany({
    where: eq(jobTargets.userId, userId),
    orderBy: [desc(jobTargets.updatedAt)],
  });
}

export async function createJobTarget(input: {
  company?: string;
  role?: string;
  jobUrl?: string;
  status?: string;
  notes?: string;
  resumeId?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { userId } = await verifySession();
  const company = input.company?.trim() || null;
  const role = input.role?.trim() || null;
  if (!company && !role) {
    return { ok: false, error: "至少填公司或岗位" };
  }
  const status = normalizeStatus(input.status);
  const [created] = await db
    .insert(jobTargets)
    .values({
      userId,
      company,
      role,
      jobUrl: input.jobUrl?.trim() || null,
      status,
      appliedAt: status === "saved" ? null : new Date(),
      notes: input.notes?.trim() || null,
      resumeId: input.resumeId ?? null,
    })
    .returning({ id: jobTargets.id });
  revalidatePath("/applications");
  return { ok: true, id: created.id };
}

export async function updateJobTarget(
  id: string,
  patch: {
    company?: string;
    role?: string;
    jobUrl?: string;
    status?: string;
    notes?: string;
    resumeId?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if ("company" in patch) set.company = patch.company?.trim() || null;
  if ("role" in patch) set.role = patch.role?.trim() || null;
  if ("jobUrl" in patch) set.jobUrl = patch.jobUrl?.trim() || null;
  if ("notes" in patch) set.notes = patch.notes?.trim() || null;
  if ("resumeId" in patch) set.resumeId = patch.resumeId ?? null;
  if ("status" in patch) {
    const status = normalizeStatus(patch.status);
    set.status = status;
    // Stamp appliedAt the first time it leaves "saved".
    if (status !== "saved") set.appliedAt = new Date();
  }

  const result = await db
    .update(jobTargets)
    .set(set)
    .where(and(eq(jobTargets.id, id), eq(jobTargets.userId, userId)))
    .returning({ id: jobTargets.id });
  if (!result[0]) return { ok: false, error: "记录不存在或无权编辑" };
  revalidatePath("/applications");
  return { ok: true };
}

export async function deleteJobTarget(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession();
  await db
    .delete(jobTargets)
    .where(and(eq(jobTargets.id, id), eq(jobTargets.userId, userId)));
  revalidatePath("/applications");
  return { ok: true };
}
