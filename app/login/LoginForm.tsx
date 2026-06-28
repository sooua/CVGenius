"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { signInWithEmail, type SignInState } from "@/app/actions/auth";

const RESEND_COOLDOWN_S = 30;

export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signInWithEmail,
    initialError ? { error: decodeURIComponent(initialError) } : null,
  );
  const [cooldown, setCooldown] = useState(0);

  // Tick the cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (state?.sent) {
    return (
      <div className="rounded-2xl bg-warm-sand/60 ring-1 ring-border-warm px-5 py-5">
        <p className="font-serif text-[17px] text-near-black mb-1.5">
          {t("sentTitle")}
        </p>
        <p className="text-[13.5px] text-olive-gray leading-relaxed mb-4">
          {t.rich("sentBody", {
            email: state.email ?? "",
            b: (chunks) => (
              <span className="text-near-black">{chunks}</span>
            ),
          })}
        </p>
        <form action={action} className="flex items-center gap-3">
          <input type="hidden" name="email" value={state.email ?? ""} />
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <button
            type="submit"
            disabled={pending || cooldown > 0}
            onClick={() => setCooldown(RESEND_COOLDOWN_S)}
            className="rounded-lg bg-white ring-1 ring-border-warm px-3.5 py-1.5 text-[13px] text-charcoal-warm hover:ring-terracotta disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {pending
              ? t("resending")
              : cooldown > 0
                ? t("resendIn", { seconds: cooldown })
                : t("resend")}
          </button>
          <span className="text-[12px] text-stone-gray">{t("checkSpam")}</span>
        </form>
        {state.error && (
          <p className="mt-3 text-[12.5px] text-error">{state.error}</p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/dashboard"} />

      <label className="block">
        <span className="block text-[12.5px] text-olive-gray mb-2 tracking-wide">
          {t("emailLabel")}
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          defaultValue={state?.email}
          placeholder={t("emailPlaceholder")}
          className="w-full rounded-xl bg-white ring-1 ring-border-warm px-4 py-3 text-[14.5px] text-near-black placeholder:text-warm-silver focus:outline-none focus:ring-2 focus:ring-terracotta transition"
        />
      </label>

      {state?.error && (
        <p className="text-[13px] text-error leading-relaxed">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        onClick={() => setCooldown(RESEND_COOLDOWN_S)}
        className="w-full rounded-xl bg-terracotta text-ivory py-3 text-[14.5px] font-medium hover:bg-coral disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {pending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
