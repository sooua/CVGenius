import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UploadForm } from "./UploadForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("upload");
  return {
    title: t("metaTitle"),
  };
}

export default async function UploadPage() {
  const t = await getTranslations("upload");
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
      <h1 className="font-serif text-[34px] leading-tight text-near-black mb-3">
        {t("heading")}
      </h1>
      <p className="text-[15px] text-olive-gray leading-relaxed max-w-xl mb-10">
        {t("intro")}
      </p>

      <UploadForm />

      <div className="mt-10 rounded-2xl bg-warm-sand/50 ring-1 ring-border-warm px-6 py-5">
        <p className="font-serif text-[15px] text-near-black mb-1.5">{t("support.title")}</p>
        <ul className="text-[13px] text-olive-gray leading-relaxed space-y-1">
          <li>{t("support.line1")}</li>
          <li>{t("support.line2")}</li>
          <li>{t("support.line3")}</li>
          <li>{t("support.line4")}</li>
          <li>{t("support.line5")}</li>
          <li>{t("support.line6")}</li>
        </ul>
      </div>
    </div>
  );
}
