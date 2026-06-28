import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/ui/FadeIn";
import { pricingSection } from "@/content/landing/sections";

export async function Pricing() {
  const t = await getTranslations("landing");
  return (
    <section id="pricing" className="px-14 py-28 bg-ivory scroll-mt-24">
      <div className="max-w-5xl mx-auto">
        <FadeIn as="header" className="mb-14 max-w-2xl">
          <span className="overline">{t(pricingSection.overline)}</span>
          <h2 className="font-serif text-[30px] md:text-[40px] leading-[1.2] text-near-black mt-5 mb-5">
            {t(pricingSection.title)}
          </h2>
          <p className="text-[16px] leading-[1.7] text-olive-gray">
            {t(pricingSection.subtitle)}
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pricingSection.tiers.map((tier, i) => (
            <FadeIn
              key={tier.key}
              as="article"
              delay={i * 140}
              className={
                (tier.highlighted
                  ? "rounded-3xl bg-white ring-2 ring-terracotta px-9 py-10 "
                  : "rounded-3xl bg-white ring-1 ring-border-warm px-9 py-10 opacity-95 ") +
                "flex flex-col gap-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(20,20,19,0.18)]"
              }
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-serif text-[22px] text-near-black">
                  {t(tier.name)}
                </h3>
                <span className="text-[12.5px] text-stone-gray tracking-wide">
                  {t(tier.priceUnit)}
                </span>
              </div>

              <div className="font-serif text-[40px] leading-none text-near-black">
                {t(tier.price)}
              </div>

              <p className="text-[13.5px] text-olive-gray leading-relaxed">
                {t(tier.description)}
              </p>

              <ul className="space-y-2.5 pt-1 flex-1">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-[13.5px] text-charcoal-warm leading-relaxed"
                  >
                    <span className="text-terracotta mt-0.5 shrink-0">·</span>
                    <span>{t(f)}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.ctaHref}
                className={
                  "press-damp w-full text-center rounded-xl py-3 text-[14px] font-medium transition " +
                  (tier.highlighted
                    ? "bg-terracotta text-ivory hover:bg-coral"
                    : "bg-near-black text-ivory hover:bg-dark-warm")
                }
              >
                {t(tier.ctaLabel)}
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
