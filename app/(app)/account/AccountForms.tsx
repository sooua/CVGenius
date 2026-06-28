"use client";

import { useActionState, useState } from "react";
import {
  deleteAccount,
  updateDisplayName,
  updateLocale,
  type AccountUpdateState,
} from "@/app/actions/account";

export function AccountForms({
  email,
  displayName,
  locale,
}: {
  email: string;
  displayName: string;
  locale: string;
}) {
  return (
    <section className="rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-6 space-y-6">
      <EmailField email={email} />
      <NameField initial={displayName} />
      <LocaleField initial={locale} />
    </section>
  );
}

function EmailField({ email }: { email: string }) {
  return (
    <div>
      <label className="block text-[12px] text-olive-gray mb-1.5 tracking-wide">
        邮箱
      </label>
      <input
        readOnly
        value={email}
        className="w-full rounded-xl bg-parchment ring-1 ring-border-warm px-3 py-2 text-[14px] text-near-black cursor-not-allowed"
      />
      <p className="mt-1.5 text-[11.5px] text-stone-gray">
        邮箱绑定登录，无法直接在这里修改。
      </p>
    </div>
  );
}

function NameField({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<AccountUpdateState, FormData>(
    updateDisplayName,
    null,
  );

  return (
    <form action={action}>
      <label
        htmlFor="displayName"
        className="block text-[12px] text-olive-gray mb-1.5 tracking-wide"
      >
        显示名
      </label>
      <div className="flex items-center gap-2">
        <input
          id="displayName"
          name="displayName"
          defaultValue={initial}
          placeholder="例如 夏禾壮"
          maxLength={120}
          className="flex-1 rounded-xl bg-white ring-1 ring-border-warm px-3 py-2 text-[14px] text-near-black placeholder:text-warm-silver focus:outline-none focus:ring-2 focus:ring-terracotta transition"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-terracotta text-ivory px-4 py-2 text-[13px] font-medium hover:bg-coral disabled:opacity-60 transition"
        >
          {pending ? "保存中…" : "保存"}
        </button>
      </div>
      <FormNotice state={state} />
    </form>
  );
}

function LocaleField({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<AccountUpdateState, FormData>(
    updateLocale,
    null,
  );

  return (
    <form action={action}>
      <label
        htmlFor="locale"
        className="block text-[12px] text-olive-gray mb-1.5 tracking-wide"
      >
        界面语言
      </label>
      <div className="flex items-center gap-2">
        <select
          id="locale"
          name="locale"
          defaultValue={initial}
          disabled={pending}
          className="flex-1 rounded-xl bg-white ring-1 ring-border-warm px-3 py-2 text-[14px] text-near-black focus:outline-none focus:ring-2 focus:ring-terracotta transition"
        >
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English（开发中）</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream disabled:opacity-60 transition"
        >
          {pending ? "切换中…" : "切换"}
        </button>
      </div>
      <FormNotice state={state} />
    </form>
  );
}

export function DataAndDanger({ email }: { email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<AccountUpdateState, FormData>(
    deleteAccount,
    null,
  );

  return (
    <section className="mt-5 rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-6">
      <p className="overline mb-1.5">数据与账号</p>
      <p className="font-serif text-[16px] text-near-black mb-1">
        导出与删除
      </p>
      <p className="text-[12.5px] text-olive-gray mb-4">
        随时把你的全部数据下载成一个 JSON 文件，或永久删除账号。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/account/export"
          className="rounded-lg bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream transition"
        >
          导出我的数据
        </a>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg px-4 py-2 text-[13px] text-error hover:bg-error/10 transition"
          >
            删除账号
          </button>
        )}
      </div>

      {confirming && (
        <form action={action} className="mt-5 space-y-3">
          <div className="rounded-2xl bg-error/5 ring-1 ring-error/20 px-5 py-4">
            <p className="text-[13px] text-near-black leading-relaxed mb-3">
              这会<strong>永久删除</strong>你的全部简历、版本历史、AI 记录和订单，
              并取消正在进行的订阅。<strong>无法恢复。</strong>
            </p>
            <label className="block text-[12px] text-olive-gray mb-1.5 tracking-wide">
              输入你的邮箱 <span className="text-near-black">{email}</span> 以确认
            </label>
            <input
              name="confirmEmail"
              autoComplete="off"
              placeholder={email}
              className="w-full rounded-xl bg-white ring-1 ring-border-warm px-3 py-2 text-[14px] text-near-black placeholder:text-warm-silver focus:outline-none focus:ring-2 focus:ring-error transition"
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-error text-ivory px-4 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-60 transition"
              >
                {pending ? "删除中…" : "我确认，永久删除"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-lg bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream disabled:opacity-60 transition"
              >
                取消
              </button>
            </div>
            <FormNotice state={state} />
          </div>
        </form>
      )}
    </section>
  );
}

function FormNotice({ state }: { state: AccountUpdateState }) {
  if (!state) return null;
  return (
    <p
      className={
        "mt-2 text-[12px] " +
        (state.ok ? "text-olive-gray" : "text-error")
      }
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}
