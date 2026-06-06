"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Locale } from "@healthpay/shared";
import { dir as dirOf, label as pickLabel, type BilingualLabel } from "@healthpay/shared";
import { LOCALE_COOKIE, t as translate } from "@/lib/i18n";

interface I18nContextValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  /** Resolve a bilingual label from @healthpay/shared in the current locale. */
  L: (l: BilingualLabel | undefined | null) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `${LOCALE_COOKIE}=${l};path=/;max-age=${60 * 60 * 24 * 365}`;
    document.documentElement.lang = l;
    document.documentElement.dir = dirOf(l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
  }, [locale]);

  const value: I18nContextValue = {
    locale,
    dir: dirOf(locale),
    setLocale,
    t: (key) => translate(locale, key),
    L: (l) => (l ? pickLabel(l, locale) : ""),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within a LocaleProvider");
  return ctx;
}

/** Small EN/AR switch. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
      className={`rounded border border-current/20 px-2 py-1 text-xs font-medium ${className}`}
      aria-label="Toggle language"
    >
      {t("lang.toggle")}
    </button>
  );
}
