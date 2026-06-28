import Link from "next/link";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db/client";
import { users } from "@/db/schema/users";
import { verifySession } from "@/lib/auth/dal";
import { startProCheckout } from "@/app/actions/billing";
import { PRO_PLAN } from "@/config/plans";

export default async function BillingStartPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const t = await getTranslations("billing");
  const { userId } = await verifySession();
  const sp = await searchParams;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, plan: true },
  });

  if (user?.plan === "pro") {
    return (
      <div className="mx-auto max-w-xl py-6">
        <p className="overline mb-5">{t("alreadyPro.overline")}</p>
        <h1 className="font-serif text-[30px] leading-tight text-near-black mb-3">
          {t("alreadyPro.title")}
        </h1>
        <p className="text-[14px] text-olive-gray leading-relaxed mb-8">
          {t("alreadyPro.desc")}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex rounded-xl bg-terracotta text-ivory px-5 py-2.5 text-[14px] font-medium hover:bg-coral transition"
        >
          {t("backToDashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <p className="overline mb-5">{t("overline", { plan: PRO_PLAN.name })}</p>
      <h1 className="font-serif text-[30px] leading-tight text-near-black mb-3">
        {t("title", { plan: PRO_PLAN.name })}
      </h1>
      <p className="text-[14px] text-olive-gray leading-relaxed mb-8">
        {t("intro")}
      </p>

      <section className="rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-8 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-serif text-[22px] text-near-black">
            {PRO_PLAN.name}
          </h2>
          <p className="text-[13px] text-stone-gray tracking-wide">
            {PRO_PLAN.priceUnit}
          </p>
        </div>
        <p className="font-serif text-[36px] leading-none text-near-black mb-5">
          {PRO_PLAN.priceDisplay}
          <span className="text-[14px] text-olive-gray tracking-wide ml-2">
            USD
          </span>
        </p>
        <ul className="space-y-2 text-[13.5px] text-charcoal-warm leading-relaxed">
          <li>{t("feature.aiUnlimited")}</li>
          <li>{t("feature.pdfUnlimited")}</li>
          <li>{t("feature.multiVersion")}</li>
          <li>{t("feature.prioritySupport")}</li>
        </ul>
      </section>

      {sp.canceled ? (
        <p className="text-[13px] text-stone-gray mb-4">
          {t("canceledNotice")}
        </p>
      ) : null}

      <form action={startProCheckout} className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-xl bg-terracotta text-ivory px-6 py-3 text-[14px] font-medium hover:bg-coral transition"
        >
          {t("goToCheckout")}
        </button>
        <Link
          href="/dashboard"
          className="text-[13px] text-stone-gray hover:text-near-black transition"
        >
          {t("notNow")}
        </Link>
      </form>

      <p className="mt-8 text-[12px] text-stone-gray leading-relaxed">
        {t("accountFooter", { email: user?.email ?? "" })}
      </p>
    </div>
  );
}
