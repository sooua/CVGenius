import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { signOut } from "@/app/actions/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const t = await getTranslations("nav");

  return (
    <div className="min-h-screen bg-parchment">
      <header className="flex items-center justify-between gap-3 border-b border-border-warm px-4 md:px-8 py-4 md:py-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 md:gap-2.5 text-near-black min-w-0"
        >
          <span className="w-5 h-5 rounded-full bg-terracotta shrink-0" />
          <span className="font-serif text-[15px] truncate">{t("brand")}</span>
        </Link>

        <div className="flex items-center gap-3 md:gap-5 text-[13px] min-w-0">
          <Link
            href="/account"
            className="text-olive-gray hover:text-near-black transition hidden sm:inline truncate max-w-[180px]"
            title={t("accountTitle")}
          >
            {user.displayName ?? user.email}
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg bg-warm-sand px-3 py-1.5 text-charcoal-warm hover:bg-border-cream transition shrink-0"
            >
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>

      <main className="px-4 md:px-8 py-8 md:py-10">{children}</main>
    </div>
  );
}
