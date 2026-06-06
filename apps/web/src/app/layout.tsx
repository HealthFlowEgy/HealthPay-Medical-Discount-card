import type { Metadata } from "next";
import { cookies } from "next/headers";
import { isLocale, dir } from "@healthpay/shared";
import { LOCALE_COOKIE, DEFAULT_LOCALE } from "@/lib/i18n";
import { LocaleProvider } from "@/components/LocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthPay Quote Engine",
  description: "Medical-discount pricing quotes for partner platforms.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  return (
    <html lang={locale} dir={dir(locale)}>
      <body>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
