import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema/orders";
import { getCurrentUser } from "@/lib/auth/dal";
import { signOut } from "@/app/actions/auth";
import { openBillingPortal } from "@/app/actions/billing";
import { AccountForms, DataAndDanger } from "./AccountForms";

export const metadata: Metadata = {
  title: "账户",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export default async function AccountPage() {
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
        <span>返回 Dashboard</span>
      </Link>

      <p className="overline mb-5">账户</p>
      <h1 className="font-serif text-[28px] md:text-[32px] leading-tight text-near-black mb-3">
        账户设置
      </h1>
      <p className="text-[14px] text-olive-gray leading-relaxed mb-10 max-w-xl">
        这些是你的基本信息。邮箱由 Supabase 管理，改邮箱需要重新走 magic link 流程。
      </p>

      <AccountForms
        email={user.email}
        displayName={user.displayName ?? ""}
        locale={user.locale}
      />

      <section className="mt-8 rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="overline mb-1.5">订阅</p>
            <h2 className="font-serif text-[18px] text-near-black">
              {isPro ? "你在 Pro 套餐" : "免费套餐"}
            </h2>
            <p className="mt-1 text-[12.5px] text-olive-gray">
              {isPro
                ? "不限次 AI 改写 / 体检 / PDF 解析 已解锁。"
                : "每月 30 次改写 / 5 次体检 / 3 次解析。升级解锁不限次。"}
            </p>
          </div>
          {isPro ? (
            <form action={openBillingPortal}>
              <button
                type="submit"
                className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition whitespace-nowrap"
              >
                管理订阅
              </button>
            </form>
          ) : (
            <Link
              href="/billing/start"
              className="rounded-lg bg-terracotta text-ivory px-3 py-1.5 text-[12.5px] hover:bg-coral transition whitespace-nowrap"
            >
              升级到 Pro
            </Link>
          )}
        </div>

        {recentOrders.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border-warm">
            <p className="text-[12px] text-stone-gray mb-3 tracking-wide">
              最近订单
            </p>
            <ul className="space-y-1.5">
              {recentOrders.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 text-[12.5px]"
                >
                  <span className="text-charcoal-warm">
                    {o.plan === "monthly" ? "Pro 月度" : "单次"} ·{" "}
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
        <p className="overline mb-1.5">会话</p>
        <p className="font-serif text-[16px] text-near-black mb-1">登录与退出</p>
        <p className="text-[12.5px] text-olive-gray mb-4">
          退出后需要再次通过邮箱 magic link 登录。
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream transition"
          >
            退出登录
          </button>
        </form>
      </section>

      <DataAndDanger email={user.email} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "text-terracotta"
      : status === "failed" || status === "refunded"
        ? "text-error"
        : "text-stone-gray";
  const label =
    status === "paid"
      ? "已支付"
      : status === "pending"
        ? "处理中"
        : status === "failed"
          ? "失败"
          : status === "refunded"
            ? "已退款"
            : status;
  return <span className={tone}>{label}</span>;
}
