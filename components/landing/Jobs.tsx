import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/ui/FadeIn";
import { jobsSection } from "@/content/landing/sections";

export async function Jobs() {
  const t = await getTranslations("landing");
  return (
    <section id="jobs" className="px-14 py-28 bg-ivory scroll-mt-24">
      <div className="max-w-6xl mx-auto">
        <FadeIn as="header" className="mb-12 max-w-2xl">
          <span className="overline">{t(jobsSection.overline)}</span>
          <h2 className="font-serif text-[30px] md:text-[40px] leading-[1.2] text-near-black mt-5 mb-5">
            {t(jobsSection.title)}
          </h2>
          <p className="text-[16px] leading-[1.7] text-olive-gray">
            {t(jobsSection.subtitle)}
          </p>
        </FadeIn>

        <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {jobsSection.categories.map((cat, i) => (
            <FadeIn
              key={cat.key}
              as="li"
              delay={i * 60}
              className="rounded-2xl bg-white ring-1 ring-border-warm px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:ring-terracotta hover:shadow-[0_10px_30px_-16px_rgba(201,100,66,0.35)]"
            >
              <p className="font-serif text-[17px] text-near-black mb-1.5">
                {t(cat.name)}
              </p>
              <p className="text-[12.5px] text-stone-gray leading-relaxed">
                {t(cat.tags)}
              </p>
            </FadeIn>
          ))}
        </ul>
      </div>
    </section>
  );
}
