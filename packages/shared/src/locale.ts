/** Locale + bilingual label helpers shared across API, SDK and UI. */

export type Locale = "en" | "ar";

export interface BilingualLabel {
  en: string;
  ar: string;
}

export const LOCALES: readonly Locale[] = ["en", "ar"];

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "ar";
}

/** Pick the label for a locale (defaults to English). */
export function label(l: BilingualLabel, locale: Locale = "en"): string {
  return locale === "ar" ? l.ar : l.en;
}

/** Text direction for a locale. */
export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
