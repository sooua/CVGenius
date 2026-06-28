import { getTranslations } from "next-intl/server";
import { MfaChallenge } from "./MfaChallenge";

export async function generateMetadata() {
  const t = await getTranslations("mfa");
  return {
    title: t("metaTitle"),
  };
}

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/dashboard";
  const t = await getTranslations("mfa");

  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-10">
        <p className="overline mb-3">{t("overline")}</p>
        <h1 className="font-serif text-[24px] leading-tight text-near-black mb-2">
          {t("title")}
        </h1>
        <p className="text-[13.5px] text-olive-gray leading-relaxed mb-6">
          {t("description")}
        </p>
        <MfaChallenge next={safeNext} />
      </div>
    </div>
  );
}
