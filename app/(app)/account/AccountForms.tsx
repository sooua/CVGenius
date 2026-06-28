"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteAccount,
  requestEmailChange,
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
  const t = useTranslations("account");
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<AccountUpdateState, FormData>(
    requestEmailChange,
    null,
  );

  return (
    <div>
      <label
        htmlFor="email"
        className="block text-[12px] text-olive-gray mb-1.5 tracking-wide"
      >
        {t("email.label")}
      </label>
      {!editing ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={email}
            className="flex-1 rounded-xl bg-parchment ring-1 ring-border-warm px-3 py-2 text-[14px] text-near-black"
          />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-xl bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream transition"
          >
            {t("email.change")}
          </button>
        </div>
      ) : (
        <form action={action}>
          <div className="flex items-center gap-2">
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t("email.placeholder")}
              className="flex-1 rounded-xl bg-white ring-1 ring-border-warm px-3 py-2 text-[14px] text-near-black placeholder:text-warm-silver focus:outline-none focus:ring-2 focus:ring-terracotta transition"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-terracotta text-ivory px-4 py-2 text-[13px] font-medium hover:bg-coral disabled:opacity-60 transition"
            >
              {pending ? t("email.sending") : t("email.sendConfirm")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="rounded-xl text-stone-gray px-2 py-2 text-[13px] hover:text-near-black disabled:opacity-60 transition"
            >
              {t("cancel")}
            </button>
          </div>
          <FormNotice state={state} />
        </form>
      )}
      {!editing && (
        <p className="mt-1.5 text-[11.5px] text-stone-gray">
          {t("email.hint")}
        </p>
      )}
    </div>
  );
}

function NameField({ initial }: { initial: string }) {
  const t = useTranslations("account");
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
        {t("name.label")}
      </label>
      <div className="flex items-center gap-2">
        <input
          id="displayName"
          name="displayName"
          defaultValue={initial}
          placeholder={t("name.placeholder")}
          maxLength={120}
          className="flex-1 rounded-xl bg-white ring-1 ring-border-warm px-3 py-2 text-[14px] text-near-black placeholder:text-warm-silver focus:outline-none focus:ring-2 focus:ring-terracotta transition"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-terracotta text-ivory px-4 py-2 text-[13px] font-medium hover:bg-coral disabled:opacity-60 transition"
        >
          {pending ? t("name.saving") : t("name.save")}
        </button>
      </div>
      <FormNotice state={state} />
    </form>
  );
}

function LocaleField({ initial }: { initial: string }) {
  const t = useTranslations("account");
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
        {t("locale.label")}
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
          <option value="en-US">English</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream disabled:opacity-60 transition"
        >
          {pending ? t("locale.switching") : t("locale.switch")}
        </button>
      </div>
      <FormNotice state={state} />
    </form>
  );
}

export function DataAndDanger({ email }: { email: string }) {
  const t = useTranslations("account");
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<AccountUpdateState, FormData>(
    deleteAccount,
    null,
  );

  return (
    <section className="mt-5 rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-6">
      <p className="overline mb-1.5">{t("data.overline")}</p>
      <p className="font-serif text-[16px] text-near-black mb-1">
        {t("data.title")}
      </p>
      <p className="text-[12.5px] text-olive-gray mb-4">
        {t("data.desc")}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/account/export"
          className="rounded-lg bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream transition"
        >
          {t("data.export")}
        </a>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg px-4 py-2 text-[13px] text-error hover:bg-error/10 transition"
          >
            {t("data.delete")}
          </button>
        )}
      </div>

      {confirming && (
        <form action={action} className="mt-5 space-y-3">
          <div className="rounded-2xl bg-error/5 ring-1 ring-error/20 px-5 py-4">
            <p className="text-[13px] text-near-black leading-relaxed mb-3">
              {t.rich("data.deleteWarning", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <label className="block text-[12px] text-olive-gray mb-1.5 tracking-wide">
              {t.rich("data.confirmLabel", {
                email,
                email_node: (chunks) => (
                  <span className="text-near-black">{chunks}</span>
                ),
              })}
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
                {pending ? t("data.deleting") : t("data.confirmDelete")}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-lg bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream disabled:opacity-60 transition"
              >
                {t("cancel")}
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
