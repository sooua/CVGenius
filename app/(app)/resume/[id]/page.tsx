import { notFound } from "next/navigation";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aiTasks } from "@/db/schema/aiTasks";
import { getResume, listResumeVersions } from "@/app/actions/resumes";
import { verifySession } from "@/lib/auth/dal";
import { getAiQuotaSnapshot } from "@/lib/ai/quota";
import { parseResumeContent } from "@/lib/resume/schema";
import { normalizeTemplate } from "@/lib/resume/templates";
import { normalizeSectionOrder } from "@/lib/resume/sections";
import { checkupResultSchema } from "@/services/ai/schemas";
import { ResumeEditor } from "./ResumeEditor";

export default async function ResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resume = await getResume(id);
  if (!resume) notFound();

  const content = parseResumeContent(resume.currentVersionJson);

  const { userId } = await verifySession();
  const quotaSnapshot = await getAiQuotaSnapshot(userId);

  const latest = await db.query.aiTasks.findFirst({
    where: and(
      eq(aiTasks.resumeId, resume.id),
      eq(aiTasks.taskType, "checkup"),
      eq(aiTasks.status, "success"),
    ),
    orderBy: [desc(aiTasks.createdAt)],
  });

  const parsed = latest
    ? checkupResultSchema.safeParse(latest.outputJson)
    : null;
  const initialCheckup =
    parsed?.success && latest
      ? { data: parsed.data, at: latest.createdAt.toISOString() }
      : null;

  const versionRows = await listResumeVersions(resume.id);
  const initialVersions = versionRows.map((v) => ({
    id: v.id,
    label: v.label,
    at: v.createdAt.toISOString(),
  }));

  const crumbTitle =
    content.basicInfo.name ||
    content.basicInfo.headline ||
    "未命名简历";

  return (
    <div className="mx-auto max-w-4xl">
      <nav className="flex items-center justify-between gap-3 mb-6 text-[13px]">
        <div className="flex items-center gap-1.5 text-olive-gray min-w-0">
          <Link
            href="/dashboard"
            className="hover:text-near-black transition"
          >
            Dashboard
          </Link>
          <span className="text-stone-gray shrink-0">/</span>
          <span className="truncate text-near-black">{crumbTitle}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/upload"
            className="rounded-lg bg-warm-sand text-charcoal-warm px-2.5 py-1 text-[12px] hover:bg-border-cream transition"
          >
            上传
          </Link>
          <Link
            href="/account"
            className="rounded-lg bg-warm-sand text-charcoal-warm px-2.5 py-1 text-[12px] hover:bg-border-cream transition"
          >
            账户
          </Link>
        </div>
      </nav>
      <ResumeEditor
        resumeId={resume.id}
        initialContent={content}
        initialCheckup={initialCheckup}
        initialQuota={quotaSnapshot}
        initialTemplate={normalizeTemplate(resume.template)}
        initialSectionOrder={normalizeSectionOrder(resume.sectionOrder)}
        initialShare={{
          enabled: resume.shareEnabled,
          token: resume.shareToken,
          expiresAt: resume.shareExpiresAt
            ? resume.shareExpiresAt.toISOString()
            : null,
          hasPasscode: resume.sharePasscode !== null,
        }}
        initialVersions={initialVersions}
      />
    </div>
  );
}
