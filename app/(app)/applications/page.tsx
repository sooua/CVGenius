import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { listResumes } from "@/app/actions/resumes";
import { listJobTargets } from "@/app/actions/applications";
import { parseResumeContent } from "@/lib/resume/schema";
import { ApplicationsBoard, type ResumeOption } from "./ApplicationsBoard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("applications");
  return { title: t("metaTitle") };
}

export default async function ApplicationsPage() {
  await getCurrentUser();
  const t = await getTranslations("applications");
  const [items, resumes] = await Promise.all([listJobTargets(), listResumes()]);

  const resumeOptions: ResumeOption[] = resumes.map((r) => {
    const content = parseResumeContent(r.currentVersionJson);
    return {
      id: r.id,
      label:
        content.basicInfo.name ||
        content.basicInfo.headline ||
        content.targetRole ||
        r.id.slice(0, 8),
    };
  });

  const initial = items.map((it) => ({
    id: it.id,
    company: it.company ?? "",
    role: it.role ?? "",
    jobUrl: it.jobUrl ?? "",
    status: it.status,
    notes: it.notes ?? "",
    resumeId: it.resumeId,
    updatedAt: it.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-3xl py-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-[13px] text-olive-gray hover:text-near-black transition mb-6"
      >
        <span>←</span>
        <span>{t("backToDashboard")}</span>
      </Link>

      <p className="overline mb-5">{t("overline")}</p>
      <h1 className="font-serif text-[28px] md:text-[32px] leading-tight text-near-black mb-3">
        {t("title")}
      </h1>
      <p className="text-[14px] text-olive-gray leading-relaxed mb-8 max-w-xl">
        {t("intro")}
      </p>

      <ApplicationsBoard initialItems={initial} resumes={resumeOptions} />
    </div>
  );
}
