/** Small, locale-aware formatting helpers (no Intl dependency assumptions). */

import type { Locale } from "./i18n";

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Render a number with thousands separators, in Western or Arabic-Indic digits. */
export function formatNumber(n: number, locale: Locale): string {
  const grouped = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (locale === "ar") return grouped.replace(/\d/g, (d) => AR_DIGITS[Number(d)] ?? d);
  return grouped;
}

/** "320 EGP" / "٣٢٠ ج.م" — currency after the amount, RTL-friendly. */
export function formatPrice(amount: number, currency: string, locale: Locale): string {
  const cur = locale === "ar" && currency === "EGP" ? "ج.م" : currency;
  return `${formatNumber(amount, locale)} ${cur}`;
}

/** Discount percent, e.g. "-60%". */
export function formatDiscount(pct: number, locale: Locale): string {
  return `-${formatNumber(pct, locale)}%`;
}
