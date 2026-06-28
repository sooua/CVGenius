import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/ui/FadeIn";
import { philosophySection } from "@/content/landing/sections";

export async function Philosophy() {
  const t = await getTranslations("landing");
  return (
    <section id="philosophy" className="px-14 py-28 scroll-mt-24">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-10 md:gap-16 items-start">
        <FadeIn>
          <span className="overline">{t(philosophySection.overline)}</span>
          <h2 className="font-serif text-[28px] md:text-[36px] leading-[1.2] text-near-black mt-5 mb-5">
            {t(philosophySection.title)}
          </h2>
          <p className="font-serif text-[18px] leading-[1.5] text-terracotta">
            {t(philosophySection.subtitle)}
          </p>
        </FadeIn>

        <ul className="space-y-6 pt-2">
          {philosophySection.principles.map((p, i) => (
            <FadeIn
              key={p.key}
              as="li"
              delay={i * 100}
              className="border-l-2 border-terracotta pl-5 transition-colors duration-300 hover:border-near-black"
            >
              <p className="font-serif text-[17px] text-near-black mb-1.5">
                {t(p.label)}
              </p>
              <p className="text-[14px] leading-[1.7] text-olive-gray">
                {t(p.body)}
              </p>
            </FadeIn>
          ))}
        </ul>
      </div>
    </section>
  );
}
