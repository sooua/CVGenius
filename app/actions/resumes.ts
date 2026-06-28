"use server";

import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { resumes, resumeVersions } from "@/db/schema/resumes";
import { verifySession } from "@/lib/auth/dal";
import { hashPasscode } from "@/lib/share";
import { normalizeTemplate, type TemplateId } from "@/lib/resume/templates";
import {
  normalizeSectionOrder,
  type SectionKey,
} from "@/lib/resume/sections";
import {
  emptyResumeContent,
  parseResumeContent,
  resumeContentSchema,
  type ResumeContent,
} from "@/lib/resume/schema";

function generateShareToken() {
  return randomBytes(16).toString("base64url");
}

export async function listResumes() {
  const { userId } = await verifySession();
  return db.query.resumes.findMany({
    where: eq(resumes.userId, userId),
    orderBy: [desc(resumes.updatedAt)],
  });
}

export async function getResume(id: string) {
  const { userId } = await verifySession();
  return db.query.resumes.findFirst({
    where: and(eq(resumes.id, id), eq(resumes.userId, userId)),
  });
}

export async function createResume() {
  const { userId } = await verifySession();
  const [created] = await db
    .insert(resumes)
    .values({
      userId,
      sourceType: "create",
      currentVersionJson: emptyResumeContent(),
    })
    .returning({ id: resumes.id });

  revalidatePath("/dashboard");
  redirect(`/resume/${created.id}`);
}

export async function createExampleResume() {
  const { userId } = await verifySession();
  const { exampleResumeContent } = await import("@/content/examples/resume");
  const [created] = await db
    .insert(resumes)
    .values({
      userId,
      sourceType: "create",
      currentVersionJson: exampleResumeContent(),
    })
    .returning({ id: resumes.id });

  revalidatePath("/dashboard");
  redirect(`/resume/${created.id}`);
}

export async function updateResume(
  id: string,
  content: ResumeContent,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession();

  const parsed = resumeContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: "简历内容格式有误" };
  }

  const result = await db
    .update(resumes)
    .set({ currentVersionJson: parsed.data, updatedAt: new Date() })
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
    .returning({ id: resumes.id });

  if (!result[0]) {
    return { ok: false, error: "简历不存在或无权编辑" };
  }

  revalidatePath(`/resume/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteResume(id: string) {
  const { userId } = await verifySession();
  await db
    .delete(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)));
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function setResumeTemplate(
  id: string,
  template: TemplateId,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession();
  const result = await db
    .update(resumes)
    .set({ template: normalizeTemplate(template), updatedAt: new Date() })
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
    .returning({ id: resumes.id });
  if (!result[0]) return { ok: false, error: "简历不存在或无权编辑" };
  revalidatePath(`/resume/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setResumeSectionOrder(
  id: string,
  order: SectionKey[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession();
  const result = await db
    .update(resumes)
    .set({ sectionOrder: normalizeSectionOrder(order), updatedAt: new Date() })
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
    .returning({ id: resumes.id });
  if (!result[0]) return { ok: false, error: "简历不存在或无权编辑" };
  revalidatePath(`/resume/${id}`);
  return { ok: true };
}

/** Same delete, but for in-list use: returns a result instead of redirecting. */
export async function removeResume(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession();
  const result = await db
    .delete(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
    .returning({ id: resumes.id });
  if (!result[0]) return { ok: false, error: "简历不存在或无权删除" };
  revalidatePath("/dashboard");
  return { ok: true };
}

export type ShareSettings = {
  /** Days until the link expires. null = never. Omit to keep current value. */
  expiresInDays?: number | null;
  /** New passcode. null/"" clears it. Omit to keep current value. */
  passcode?: string | null;
};

export type ShareActionResult =
  | {
      ok: true;
      token: string | null;
      expiresAt: string | null;
      hasPasscode: boolean;
    }
  | { ok: false; error: string };

export async function setShareEnabled(
  id: string,
  enabled: boolean,
  options?: ShareSettings,
): Promise<ShareActionResult> {
  const { userId } = await verifySession();

  const existing = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, id), eq(resumes.userId, userId)),
    columns: {
      id: true,
      shareToken: true,
      shareExpiresAt: true,
      sharePasscode: true,
    },
  });
  if (!existing) return { ok: false, error: "简历不存在或无权编辑" };

  const token = enabled
    ? existing.shareToken ?? generateShareToken()
    : existing.shareToken;

  // Resolve expiry: omitted → keep; null → never; number → now + N days.
  let expiresAt = existing.shareExpiresAt ?? null;
  if (options && "expiresInDays" in options) {
    const days = options.expiresInDays;
    expiresAt =
      days == null
        ? null
        : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  // Resolve passcode: omitted → keep; null/"" → clear; string → hash.
  let passcode = existing.sharePasscode ?? null;
  if (options && "passcode" in options) {
    const raw = options.passcode?.trim();
    passcode = raw ? hashPasscode(raw) : null;
  }

  await db
    .update(resumes)
    .set({
      shareEnabled: enabled,
      shareToken: token,
      shareExpiresAt: expiresAt,
      sharePasscode: passcode,
      updatedAt: new Date(),
    })
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)));

  revalidatePath(`/resume/${id}`);
  return {
    ok: true,
    token: enabled ? token : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    hasPasscode: passcode !== null,
  };
}

export async function saveResumeVersion(
  id: string,
  label?: string,
): Promise<{ ok: true; versionId: string } | { ok: false; error: string }> {
  const { userId } = await verifySession();

  const source = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, id), eq(resumes.userId, userId)),
    columns: { id: true, currentVersionJson: true },
  });
  if (!source || !source.currentVersionJson) {
    return { ok: false, error: "简历不存在或内容为空" };
  }

  const [created] = await db
    .insert(resumeVersions)
    .values({
      resumeId: source.id,
      contentJson: source.currentVersionJson,
      label: label?.trim() || null,
    })
    .returning({ id: resumeVersions.id });

  revalidatePath(`/resume/${id}`);
  return { ok: true, versionId: created.id };
}

export async function listResumeVersions(id: string) {
  const { userId } = await verifySession();
  // Ownership check — leaving the join to drizzle would be nicer, but a
  // findFirst on resumes is clearer and cheap.
  const owned = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, id), eq(resumes.userId, userId)),
    columns: { id: true },
  });
  if (!owned) return [];

  return db.query.resumeVersions.findMany({
    where: eq(resumeVersions.resumeId, id),
    orderBy: [desc(resumeVersions.createdAt)],
    columns: { id: true, label: true, createdAt: true },
  });
}

export async function restoreResumeVersion(
  versionId: string,
): Promise<
  | { ok: true; resumeId: string; content: ResumeContent }
  | { ok: false; error: string }
> {
  const { userId } = await verifySession();

  const version = await db.query.resumeVersions.findFirst({
    where: eq(resumeVersions.id, versionId),
  });
  if (!version) return { ok: false, error: "版本不存在" };

  // Confirm user owns the parent resume.
  const parent = await db.query.resumes.findFirst({
    where: and(
      eq(resumes.id, version.resumeId),
      eq(resumes.userId, userId),
    ),
    columns: { id: true, currentVersionJson: true },
  });
  if (!parent) return { ok: false, error: "无权恢复此版本" };

  // Snapshot the existing state before overwriting, so restore is reversible.
  if (parent.currentVersionJson) {
    await db.insert(resumeVersions).values({
      resumeId: parent.id,
      contentJson: parent.currentVersionJson,
      label: "恢复前自动保存",
    });
  }

  await db
    .update(resumes)
    .set({
      currentVersionJson: version.contentJson,
      updatedAt: new Date(),
    })
    .where(eq(resumes.id, parent.id));

  revalidatePath(`/resume/${parent.id}`);
  return {
    ok: true,
    resumeId: parent.id,
    content: parseResumeContent(version.contentJson),
  };
}

export async function cloneResume(id: string) {
  const { userId } = await verifySession();

  const source = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, id), eq(resumes.userId, userId)),
  });
  if (!source) {
    redirect("/dashboard");
  }

  const [created] = await db
    .insert(resumes)
    .values({
      userId,
      sourceType: "create",
      parsedJson: source.parsedJson,
      currentVersionJson: source.currentVersionJson,
    })
    .returning({ id: resumes.id });

  revalidatePath("/dashboard");
  redirect(`/resume/${created.id}`);
}
