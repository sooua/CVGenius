"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type State =
  | { kind: "loading" }
  | { kind: "off" }
  | {
      kind: "enrolling";
      factorId: string;
      qr: string;
      secret: string;
      code: string;
      busy?: boolean;
      error?: string;
    }
  | { kind: "on"; factorId: string; busy?: boolean };

export function MfaSettings() {
  const supabase = supabaseBrowser();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setState({ kind: "off" });
        return;
      }
      const verified = data?.totp?.find((f) => f.status === "verified");
      setState(
        verified ? { kind: "on", factorId: verified.id } : { kind: "off" },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const startEnroll = async () => {
    setState({ kind: "loading" });
    // Drop any stale unverified factors so enroll doesn't conflict.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.totp ?? []) {
      if (f.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
    });
    if (error || !data) {
      setState({ kind: "off" });
      return;
    }
    setState({
      kind: "enrolling",
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
      code: "",
    });
  };

  const verifyEnroll = async () => {
    if (state.kind !== "enrolling") return;
    setState({ ...state, busy: true, error: undefined });
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: state.factorId,
      code: state.code.trim(),
    });
    if (error) {
      setState({ ...state, busy: false, error: "验证码不对，再试一次。" });
      return;
    }
    setState({ kind: "on", factorId: state.factorId });
  };

  const cancelEnroll = async () => {
    if (state.kind !== "enrolling") return;
    await supabase.auth.mfa.unenroll({ factorId: state.factorId });
    setState({ kind: "off" });
  };

  const disable = async () => {
    if (state.kind !== "on") return;
    setState({ ...state, busy: true });
    await supabase.auth.mfa.unenroll({ factorId: state.factorId });
    setState({ kind: "off" });
  };

  return (
    <section className="mt-5 rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="overline mb-1.5">两步验证（2FA）</p>
          <p className="font-serif text-[16px] text-near-black mb-1">
            用身份验证器 App 多加一道锁
          </p>
          <p className="text-[12.5px] text-olive-gray">
            开启后，登录时除了邮箱链接，还需要输入验证器里的 6 位动态码。
          </p>
        </div>
        {state.kind === "off" && (
          <button
            type="button"
            onClick={startEnroll}
            className="shrink-0 rounded-lg bg-terracotta text-ivory px-3.5 py-1.5 text-[12.5px] hover:bg-coral transition"
          >
            开启
          </button>
        )}
        {state.kind === "on" && (
          <button
            type="button"
            onClick={disable}
            disabled={state.busy}
            className="shrink-0 rounded-lg px-3.5 py-1.5 text-[12.5px] text-error hover:bg-error/10 disabled:opacity-60 transition"
          >
            {state.busy ? "关闭中…" : "关闭"}
          </button>
        )}
      </div>

      {state.kind === "on" && (
        <p className="mt-3 text-[12.5px] text-olive-gray">
          ✓ 两步验证已开启。
        </p>
      )}

      {state.kind === "enrolling" && (
        <div className="mt-5 rounded-2xl bg-parchment ring-1 ring-border-warm px-5 py-5">
          <p className="text-[13px] text-near-black leading-relaxed mb-3">
            用身份验证器 App（Google Authenticator、1Password、Authy 等）扫描二维码，
            或手动输入密钥，然后填入它生成的 6 位码。
          </p>
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.qr}
              alt="两步验证二维码"
              className="w-40 h-40 rounded-xl bg-white ring-1 ring-border-warm p-2"
            />
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-[11.5px] text-stone-gray mb-1">手动密钥</p>
                <code className="block break-all rounded-lg bg-white ring-1 ring-border-warm px-3 py-2 text-[12px] text-near-black font-mono">
                  {state.secret}
                </code>
              </div>
              <input
                value={state.code}
                onChange={(e) =>
                  setState({ ...state, code: e.target.value, error: undefined })
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 位动态码"
                className="w-full rounded-lg bg-white ring-1 ring-border-warm px-3 py-2 text-[15px] tracking-widest text-center text-near-black placeholder:text-warm-silver placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-terracotta transition"
              />
              {state.error && (
                <p className="text-[12.5px] text-error">{state.error}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={verifyEnroll}
                  disabled={state.busy || state.code.trim().length < 6}
                  className="rounded-lg bg-terracotta text-ivory px-4 py-2 text-[13px] font-medium hover:bg-coral disabled:opacity-50 transition"
                >
                  {state.busy ? "验证中…" : "确认开启"}
                </button>
                <button
                  type="button"
                  onClick={cancelEnroll}
                  disabled={state.busy}
                  className="rounded-lg bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream disabled:opacity-60 transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
