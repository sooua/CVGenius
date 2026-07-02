import { getTranslations } from "next-intl/server";
import { Hero } from "@/components/landing/Hero";
import { Jobs } from "@/components/landing/Jobs";
import { Nav } from "@/components/landing/Nav";
import { Philosophy } from "@/components/landing/Philosophy";
import { Pricing } from "@/components/landing/Pricing";
import { Product } from "@/components/landing/Product";

export default async function HomePage() {
  const t = await getTranslations("landing");
  return (
    <>
      <Nav />
      <Hero />
      <Product />
      <Jobs />
      <Philosophy />
      <Pricing />
      <footer className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-6 md:px-14 py-8 md:py-10 border-t border-border-warm text-[13px] text-olive-gray">
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full bg-terracotta" />
          <span className="font-serif text-near-black">
            CVGenius · {t("footer.brandNote")}
          </span>
          <span className="text-stone-gray pl-3">
            {t("footer.rights", { year: String(new Date().getFullYear()) })}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="#product">{t("footer.product")}</a>
          <a href="#pricing">{t("footer.pricing")}</a>
          <a href="#philosophy">{t("footer.philosophy")}</a>
          <a href="#contact">{t("footer.contact")}</a>
        </div>
      </footer>
    </>
  );
}
