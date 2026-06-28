import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aiTasks } from "@/db/schema/aiTasks";
import { getCurrentUser } from "@/lib/auth/dal";
import { openBillingPortal } from "@/app/actions/billing";
import {
  createExampleResume,
  createResume,
  listResumes,
} from "@/app/actions/resumes";
import { parseResumeContent } from "@/lib/resume/schema";
import { AI_QUOTAS, getMonthlyAiUsage } from "@/lib/ai/quota";
import { checkupResultSchema } from "@/services/ai/schemas";
import { ResumeList, type ResumeListItem } from "./ResumeList";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const user = await getCurrentUser();
  const resumes = await listResumes();
  const greetingName = user.displayName ?? user.email.split("@")[0];

  // Latest checkup per resume (group-latest in memory; N is small).
  const checkupTasks = await db.query.aiTasks.findMany({
    where: and(
      eq(aiTasks.userId, user.id),
      eq(aiTasks.taskType, "checkup"),
      eq(aiTasks.status, "success"),
    ),
    orderBy: [desc(aiTasks.createdAt)],
  });

  const latestCheckupByResume = new Map<string, number>();
  for (const t of checkupTasks) {
    if (!t.resumeId || latestCheckupByResume.has(t.resumeId)) continue;
    const parsed = checkupResultSchema.safeParse(t.outputJson);
    if (parsed.success) {
      latestCheckupByResume.set(t.resumeId, parsed.data.overallScore);
    }
  }

  const { rewriteUsed, checkupUsed, uploadUsed } = await getMonthlyAiUsage(
    user.id,
  );
  const isPro = user.plan === "pro";

  const resumeItems: ResumeListItem[] = resumes.map((resume) => {
    const content = parseResumeContent(resume.currentVersionJson);
    return {
      id: resume.id,
      title:
        content.basicInfo.name ||
        content.basicInfo.headline ||
        t("row.untitled"),
      subtitle: content.basicInfo.headline || t("row.noHeadline"),
      targetRole: content.targetRole?.trim() || "",
      score: latestCheckupByResume.get(resume.id) ?? null,
      updatedAt: resume.updatedAt.toISOString(),
      createdAt: resume.createdAt.toISOString(),
    };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <p className="overline mb-5">{t("overline")}</p>
      <h1 className="font-serif text-[26px] md:text-[34px] leading-tight text-near-black mb-3">
        {t("greeting", { name: greetingName })}
      </h1>
      <p className="text-[15px] text-olive-gray leading-relaxed max-w-xl mb-10">
        {t("intro")}
      </p>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-[20px] text-near-black">
            {t("myResumes")}
          </h2>
          <div className="flex items-center gap-2">
            <Link
              href="/upload"
              className="rounded-xl bg-warm-sand text-charcoal-warm px-4 py-2 text-[14px] hover:bg-border-cream transition"
            >
              {t("uploadPdf")}
            </Link>
            <form action={createResume}>
              <button
                type="submit"
                className="rounded-xl bg-terracotta text-ivory px-4 py-2 text-[14px] font-medium hover:bg-coral transition"
              >
                {t("newResume")}
              </button>
            </form>
          </div>
        </div>

        {resumes.length === 0 ? (
          <div className="rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-12 text-center">
            <p className="font-serif text-[17px] text-near-black mb-2">
              {t("empty.title")}
            </p>
            <p className="text-[13.5px] text-olive-gray max-w-md mx-auto leading-relaxed mb-6">
              {t("empty.desc")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-9">
              <form action={createExampleResume}>
                <button
                  type="submit"
                  className="rounded-xl bg-terracotta text-ivory px-5 py-2.5 text-[13px] font-medium hover:bg-coral transition"
                >
                  {t("empty.fromExample")}
                </button>
              </form>
              <Link
                href="/upload"
                className="rounded-xl bg-warm-sand text-charcoal-warm px-5 py-2.5 text-[13px] hover:bg-border-cream transition"
              >
                {t("empty.uploadFile")}
              </Link>
              <form action={createResume}>
                <button
                  type="submit"
                  className="rounded-xl bg-warm-sand text-charcoal-warm px-5 py-2.5 text-[13px] hover:bg-border-cream transition"
                >
                  {t("empty.fromBlank")}
                </button>
              </form>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto text-left">
              {[
                ["1", t("empty.step1.title"), t("empty.step1.desc")],
                ["2", t("empty.step2.title"), t("empty.step2.desc")],
                ["3", t("empty.step3.title"), t("empty.step3.desc")],
              ].map(([n, title, desc]) => (
                <div
                  key={n}
                  className="rounded-2xl bg-parchment ring-1 ring-border-warm px-4 py-3.5"
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-terracotta/10 text-terracotta text-[12px] font-medium mb-2">
                    {n}
                  </span>
                  <p className="font-serif text-[14px] text-near-black mb-0.5">
                    {title}
                  </p>
                  <p className="text-[12px] text-stone-gray leading-relaxed">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ResumeList items={resumeItems} />
        )}
      </section>

      <section className="rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-6 mb-5">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[12.5px] text-stone-gray tracking-wide">
            {t("usage.title")}
          </p>
          {isPro ? (
            <span className="text-[11px] text-terracotta tracking-wide">
              {t("usage.proUnlimited")}
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          <UsageStat
            t={t}
            label={t("usage.rewrite")}
            used={rewriteUsed}
            quota={AI_QUOTAS.rewrite}
            unlimited={isPro}
          />
          <UsageStat
            t={t}
            label={t("usage.checkup")}
            used={checkupUsed}
            quota={AI_QUOTAS.checkup}
            unlimited={isPro}
          />
          <UsageStat
            t={t}
            label={t("usage.upload")}
            used={uploadUsed}
            quota={AI_QUOTAS.upload}
            unlimited={isPro}
          />
        </div>
      </section>

      <section className="rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12.5px] text-stone-gray mb-1 tracking-wide">
              {t("account.label")}
            </p>
            <p className="font-serif text-[15px] text-near-black mb-0.5">
              {user.email}
            </p>
            <p className="text-[12.5px] text-olive-gray">
              {t("account.planLocale", {
                plan: user.plan,
                locale: user.locale,
              })}
            </p>
          </div>
          {isPro ? (
            <form action={openBillingPortal}>
              <button
                type="submit"
                className="rounded-lg bg-warm-sand px-3 py-1.5 text-[12.5px] text-charcoal-warm hover:bg-border-cream transition"
              >
                {t("account.manage")}
              </button>
            </form>
          ) : (
            <Link
              href="/billing/start"
              className="rounded-lg bg-terracotta text-ivory px-3 py-1.5 text-[12.5px] hover:bg-coral transition whitespace-nowrap"
            >
              {t("account.upgrade")}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

function UsageStat({
  t,
  label,
  used,
  quota,
  unlimited = false,
}: {
  t: Awaited<ReturnType<typeof getTranslations>>;
  label: string;
  used: number;
  quota: number;
  unlimited?: boolean;
}) {
  if (unlimited) {
    return (
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[12.5px] text-olive-gray">{label}</span>
          <span className="text-[12.5px] text-charcoal-warm tabular-nums">
            {used} <span className="text-stone-gray">/ ∞</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-terracotta/30" />
        <p className="mt-1.5 text-[11.5px] text-stone-gray">
          {t("usage.unlimited")}
        </p>
      </div>
    );
  }

  const pct = Math.min(100, (used / quota) * 100);
  const remaining = Math.max(0, quota - used);
  const low = remaining === 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12.5px] text-olive-gray">{label}</span>
        <span className="text-[12.5px] text-charcoal-warm tabular-nums">
          {used} <span className="text-stone-gray">/ {quota}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-warm-sand overflow-hidden">
        <div
          className={
            (low ? "bg-error" : "bg-terracotta") +
            " h-full rounded-full transition-all duration-700"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11.5px] text-stone-gray">
        {low ? t("usage.usedUp") : t("usage.remaining", { count: remaining })}
      </p>
    </div>
  );
}
