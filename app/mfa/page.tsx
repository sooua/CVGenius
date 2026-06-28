import type { Metadata } from "next";
import { MfaChallenge } from "./MfaChallenge";

export const metadata: Metadata = {
  title: "两步验证",
};

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/dashboard";

  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-10">
        <p className="overline mb-3">两步验证</p>
        <h1 className="font-serif text-[24px] leading-tight text-near-black mb-2">
          再验证一下身份
        </h1>
        <p className="text-[13.5px] text-olive-gray leading-relaxed mb-6">
          你开启了两步验证。打开身份验证器 App，输入当前的 6 位动态码。
        </p>
        <MfaChallenge next={safeNext} />
      </div>
    </div>
  );
}
