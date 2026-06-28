import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/ui/FadeIn";
import { productSection } from "@/content/landing/sections";

export async function Product() {
  const t = await getTranslations("landing");
  return (
    <section id="product" className="px-14 py-28 scroll-mt-24">
      <div className="max-w-6xl mx-auto">
        <FadeIn as="header" className="mb-14 max-w-2xl">
          <span className="overline">{t(productSection.overline)}</span>
          <h2 className="font-serif text-[30px] md:text-[40px] leading-[1.2] text-near-black mt-5 mb-5">
            {t(productSection.title)}
          </h2>
          <p className="text-[16px] leading-[1.7] text-olive-gray">
            {t(productSection.subtitle)}
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {productSection.features.map((feat, i) => (
            <FadeIn
              key={feat.key}
              as="article"
              delay={i * 120}
              className="group rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-10 flex flex-col gap-4 transition-all duration-500 hover:-translate-y-1 hover:ring-terracotta hover:shadow-[0_18px_40px_-20px_rgba(20,20,19,0.15)]"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-terracotta text-ivory font-serif text-[22px] transition-transform duration-500 group-hover:rotate-[-4deg] group-hover:scale-[1.06]">
                {t(feat.label)}
              </div>
              <h3 className="font-serif text-[20px] text-near-black">
                {t(feat.title)}
              </h3>
              <p className="text-[14px] leading-[1.7] text-olive-gray">
                {t(feat.body)}
              </p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
