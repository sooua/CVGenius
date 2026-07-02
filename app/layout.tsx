import type { Metadata } from "next";
import { Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

const notoSerif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

const notoSans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CVGenius · 写出你的第一份简历",
    template: "%s · CVGenius",
  },
  description:
    "面向应届生与职场新人的 AI 简历助手——把课程项目、毕业设计、校园经历，用职业语言说清楚。",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale === "en" ? "en" : "zh-CN"}
      className={`${notoSerif.variable} ${notoSans.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-parchment text-near-black">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
