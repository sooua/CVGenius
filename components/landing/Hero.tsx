import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function Hero() {
  const t = await getTranslations("landing");
  return (
    <section className="flex flex-col md:flex-row gap-12 md:gap-18 px-6 md:px-14 py-16 md:py-24 items-center bg-parchment">
      <div className="flex flex-col gap-6 md:gap-8 flex-1 w-full">
        <span className="overline">{t("hero.overline")}</span>

        <h1 className="font-serif text-[36px] md:text-[64px] leading-[1.15] text-near-black tracking-tight">
          {t.rich("hero.title", { br: () => <br /> })}
        </h1>

        <p className="max-w-[580px] text-base md:text-lg leading-[1.7] text-olive-gray">
          {t.rich("hero.description", {
            br: () => (
              <>
                <span className="hidden md:inline">
                  <br />
                </span>{" "}
              </>
            ),
          })}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-terracotta text-ivory font-medium"
          >
            {t("hero.ctaPrimary")}
            <span>→</span>
          </Link>
          <Link
            href="/upload"
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white text-near-black font-medium ring-1 ring-border-warm"
          >
            {t("hero.ctaSecondary")}
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-[13px] text-stone-gray">
          <span>{t("hero.badgeFree")}</span>
          <span className="hidden sm:inline">·</span>
          <span>{t("hero.badgeTime")}</span>
          <span className="hidden sm:inline">·</span>
          <span>{t("hero.badgeNoCard")}</span>
        </div>
      </div>

      <div className="hidden md:block">
        <HeroArt />
      </div>
    </section>
  );
}

async function HeroArt() {
  const t = await getTranslations("landing");
  return (
    <div className="relative w-[520px] h-[620px] rounded-3xl bg-ivory overflow-hidden shrink-0">
      {/* background blobs */}
      <div className="absolute w-[460px] h-[460px] rounded-full bg-warm-sand left-[30px] top-[80px]" />
      <div className="absolute w-[140px] h-[140px] rounded-full bg-terracotta left-[360px] top-[60px]" />

      {/* back paper */}
      <div
        className="absolute w-[320px] h-[440px] bg-ivory rounded-md ring-1 ring-border-warm"
        style={{
          left: 60,
          top: 120,
          transform: "rotate(-6deg)",
        }}
      />

      {/* front paper */}
      <div
        className="absolute w-[320px] h-[440px] bg-white rounded-md ring-1 ring-border-warm p-8 flex flex-col gap-3"
        style={{
          left: 100,
          top: 100,
          transform: "rotate(3deg)",
          boxShadow: "0px 8px 32px rgba(0,0,0,0.08)",
        }}
      >
        <div className="font-serif text-[22px] text-near-black">
          {t("hero.art.name")}
        </div>
        <div className="text-xs text-stone-gray">{t("hero.art.role")}</div>
        <div className="h-px bg-border-warm" />
        <div className="pt-1.5 flex flex-col gap-1.5">
          <div className="text-[11px] font-medium text-terracotta tracking-widest">
            {t("hero.art.projectLabel")}
          </div>
          <div className="font-serif text-sm text-near-black">
            {t("hero.art.projectName")}
          </div>
          <p className="text-[11px] leading-[1.6] text-olive-gray">
            {t("hero.art.projectBody")}
          </p>
        </div>
        <div className="h-0.5 rounded-sm bg-border-cream" />
        <div className="h-0.5 rounded-sm bg-border-cream" />
        <div className="h-0.5 rounded-sm bg-border-cream w-48" />
        <div className="pt-3 flex flex-col gap-1.5">
          <div className="text-[11px] font-medium text-terracotta tracking-widest">
            {t("hero.art.skillsLabel")}
          </div>
          <div className="flex gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-parchment text-[10px] text-charcoal-warm font-mono">
              Vue 3
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-parchment text-[10px] text-charcoal-warm font-mono">
              Node.js
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-parchment text-[10px] text-charcoal-warm font-mono">
              Redis
            </span>
          </div>
        </div>
      </div>

      {/* decor note */}
      <div
        className="motion-float-gentle absolute w-[180px] h-[60px] bg-terracotta rounded-3xl flex flex-col justify-center px-4"
        style={
          {
            left: 300,
            top: 480,
            "--float-rot": "5deg",
            transform: "rotate(5deg)",
          } as React.CSSProperties
        }
      >
        <div className="text-xs font-medium text-ivory">
          {t("hero.art.noteTitle")}
        </div>
        <div className="text-[10px] text-ivory/80">{t("hero.art.noteSub")}</div>
      </div>

      {/* decor dot */}
      <div
        className="motion-float-gentle absolute w-6 h-6 rounded-full bg-near-black left-[80px] top-[480px]"
        style={{ animationDelay: "1.8s" }}
      />
    </div>
  );
}
