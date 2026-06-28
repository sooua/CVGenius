import Link from "next/link";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db/client";
import { users } from "@/db/schema/users";
import { verifySession } from "@/lib/auth/dal";

export default async function BillingSuccessPage() {
  const t = await getTranslations("billing");
  const { userId } = await verifySession();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  });

  const isPro = user?.plan === "pro";

  return (
    <div className="mx-auto max-w-xl py-6">
      <p className="overline mb-5">
        {isPro ? t("success.overlineDone") : t("success.overlinePending")}
      </p>
      <h1 className="font-serif text-[32px] leading-tight text-near-black mb-3">
        {isPro ? t("success.titleDone") : t("success.titlePending")}
      </h1>
      <p className="text-[14px] text-olive-gray leading-relaxed mb-8">
        {isPro ? t("success.descDone") : t("success.descPending")}
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-xl bg-terracotta text-ivory px-5 py-2.5 text-[14px] font-medium hover:bg-coral transition"
        >
          {t("backToDashboard")}
        </Link>
        {!isPro ? (
          <Link
            href="/billing/success"
            className="text-[13px] text-stone-gray hover:text-near-black transition"
          >
            {t("success.refreshStatus")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
