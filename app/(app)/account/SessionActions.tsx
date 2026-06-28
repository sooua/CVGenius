"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SessionActions() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [busy, setBusy] = useState<null | "others" | "global">(null);
  const [done, setDone] = useState<string | null>(null);

  const signOutOthers = async () => {
    setBusy("others");
    setDone(null);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(null);
    setDone(
      error
        ? "操作失败，请稍后再试。"
        : "已退出其他所有设备，当前设备保持登录。",
    );
  };

  const signOutAll = async () => {
    setBusy("global");
    await supabase.auth.signOut({ scope: "global" });
    router.replace("/login");
  };

  return (
    <div className="mt-4 pt-4 border-t border-border-warm">
      <p className="text-[12.5px] text-olive-gray mb-3">
        在公共电脑上登录过、或怀疑账号被别人登录，可以一键把其它设备踢下线。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={signOutOthers}
          disabled={busy !== null}
          className="rounded-lg bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream disabled:opacity-60 transition"
        >
          {busy === "others" ? "处理中…" : "退出其他设备"}
        </button>
        <button
          type="button"
          onClick={signOutAll}
          disabled={busy !== null}
          className="rounded-lg px-4 py-2 text-[13px] text-error hover:bg-error/10 disabled:opacity-60 transition"
        >
          {busy === "global" ? "处理中…" : "退出所有设备"}
        </button>
      </div>
      {done && <p className="mt-2.5 text-[12.5px] text-olive-gray">{done}</p>}
    </div>
  );
}
