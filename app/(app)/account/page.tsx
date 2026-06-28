import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema/orders";
import { getCurrentUser } from "@/lib/auth/dal";
import { signOut } from "@/app/actions/auth";
import { openBillingPortal } from "@/app/actions/billing";
import { AccountForms, DataAndDanger } from "./AccountForms";
import { MfaSettings } from "./MfaSettings";
import { SessionActions } from "./SessionActions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return {
    title: t("metaTitle"),
  };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export default async function AccountPage() {
  const t = await getTranslations("account");
  const user = await getCurrentUser();
  const isPro = user.plan === "pro";

  const recentOrders = await db.query.orders.findMany({
    where: eq(orders.userId, user.id),
    orderBy: [desc(orders.createdAt)],
    limit: 5,
  });

  return (
    <div className="mx-auto max-w-2xl py-4">
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
      <p className="text-[14px] text-olive-gray leading-relaxed mb-10 max-w-xl">
        {t("intro")}
      </p>

      <AccountForms
        email={user.email}
        displayName={user.displayName ?? ""}
        locale={user.locale}
      />

      <section className="mt-8 rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="overline mb-1.5">{t("subscription.overline")}</p>
            <h2 className="font-serif text-[18px] text-near-black">
              {isPro ? t("subscription.proTitle") : t("subscription.freeTitle")}
            </h2>
            <p className="mt-1 text-[12.5px] text-olive-gray">
              {isPro
                ? t("subscription.proDesc")
                : t("subscription.freeDesc")}
            </p>
          </div>
          {isPro ? (
            <form action={openBillingPortal}>
              <button
                type="submit"
                className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition whitespace-nowrap"
              >
                {t("subscription.manage")}
              </button>
            </form>
          ) : (
            <Link
              href="/billing/start"
              className="rounded-lg bg-terracotta text-ivory px-3 py-1.5 text-[12.5px] hover:bg-coral transition whitespace-nowrap"
            >
              {t("subscription.upgrade")}
            </Link>
          )}
        </div>

        {recentOrders.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border-warm">
            <p className="text-[12px] text-stone-gray mb-3 tracking-wide">
              {t("subscription.recentOrders")}
            </p>
            <ul className="space-y-1.5">
              {recentOrders.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 text-[12.5px]"
                >
                  <span className="text-charcoal-warm">
                    {o.plan === "monthly"
                      ? t("order.monthly")
                      : t("order.oneTime")}{" "}
                    ·{" "}
                    {o.currency} {(o.amountCents / 100).toFixed(2)}
                  </span>
                  <span className="text-stone-gray">
                    {formatDate(o.createdAt)} ·{" "}
                    <StatusBadge status={o.status} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-6">
        <p className="overline mb-1.5">{t("session.overline")}</p>
        <p className="font-serif text-[16px] text-near-black mb-1">
          {t("session.title")}
        </p>
        <p className="text-[12.5px] text-olive-gray mb-4">
          {t("session.desc")}
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream transition"
          >
            {t("session.signOutCurrent")}
          </button>
        </form>

        <SessionActions />
      </section>

      <MfaSettings />

      <DataAndDanger email={user.email} />
    </div>
  );
}

async function StatusBadge({ status }: { status: string }) {
  const t = await getTranslations("account");
  const tone =
    status === "paid"
      ? "text-terracotta"
      : status === "failed" || status === "refunded"
        ? "text-error"
        : "text-stone-gray";
  const label =
    status === "paid"
      ? t("status.paid")
      : status === "pending"
        ? t("status.pending")
        : status === "failed"
          ? t("status.failed")
          : status === "refunded"
            ? t("status.refunded")
            : status;
  return <span className={tone}>{label}</span>;
}
