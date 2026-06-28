import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_COOKIE = "LOCALE";

/** Maps the stored users.locale ("zh-CN" / "en-US") to a message locale. */
export function toMessageLocale(value: string | null | undefined): Locale {
  return value?.startsWith("en") ? "en" : "zh";
}

export default getRequestConfig(async () => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = cookie === "en" ? "en" : "zh";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
