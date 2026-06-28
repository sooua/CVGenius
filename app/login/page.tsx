import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("metaTitle") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("login");
  return (
    <main className="min-h-screen bg-parchment flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-10 flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full bg-terracotta" />
          <span className="font-serif text-[15px] text-near-black">
            {t("brand")}
          </span>
        </div>

        <div className="rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-10">
          <p className="overline mb-4">{t("overline")}</p>
          <h1 className="font-serif text-[28px] leading-tight text-near-black mb-3">
            {t("title")}
          </h1>
          <p className="text-[14px] text-olive-gray leading-relaxed mb-8">
            {t("intro")}
          </p>

          <LoginForm next={params.next} initialError={params.error} />
        </div>

        <p className="mt-8 text-center text-[12.5px] text-stone-gray">
          {t("consent")}
        </p>
      </div>
    </main>
  );
}
