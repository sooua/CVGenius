"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export function MfaChallenge({ next }: { next: string }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.mfa.listFactors().then(({ data }) => {
      if (cancelled) return;
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) setFactorId(verified.id);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const submit = async () => {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    if (error) {
      setError("验证码不对，再试一次。");
      setBusy(false);
      return;
    }
    router.replace(next || "/dashboard");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <input
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          if (error) setError(null);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="6 位动态码"
        onKeyDown={(e) => {
          if (e.key === "Enter" && code.trim().length >= 6) submit();
        }}
        className="w-full rounded-xl bg-white ring-1 ring-border-warm px-4 py-3 text-[18px] tracking-[0.4em] text-center text-near-black placeholder:text-warm-silver placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-terracotta transition"
      />
      {error && <p className="text-[13px] text-error">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy || code.trim().length < 6}
        className="w-full rounded-xl bg-terracotta text-ivory py-3 text-[14.5px] font-medium hover:bg-coral disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {busy ? "验证中…" : "验证并进入"}
      </button>
    </div>
  );
}
