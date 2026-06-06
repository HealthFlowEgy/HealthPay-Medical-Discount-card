/**
 * Egyptian mobile number normalization to E.164.
 *
 * Accepts the common written forms:
 *   01[0125]XXXXXXXX           (local, 11 digits)
 *   +201[0125]XXXXXXXX         (E.164)
 *   00201[0125]XXXXXXXX        (international access code)
 *   201[0125]XXXXXXXX          (bare country code)
 *
 * Operator prefixes: 010 Vodafone, 011 e& (Etisalat), 012 Orange, 015 WE.
 * Always stored as E.164: +20 followed by the 10-digit national number
 * (1[0125] + 8 digits).
 */

export type MobileValidation =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: string };

/** National significant number: 1, operator digit, then 8 digits. */
const NSN_RE = /^1[0125]\d{8}$/;

export function normalizeEgyptianMobile(raw: string): MobileValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "Mobile must be a string." };
  }
  // Strip spaces, dashes, parentheses, dots.
  let value = raw.trim().replace(/[\s\-().]/g, "");

  // Reduce any accepted prefix to the 10-digit national significant number.
  if (value.startsWith("+20")) {
    value = value.slice(3);
  } else if (value.startsWith("0020")) {
    value = value.slice(4);
  } else if (value.startsWith("20") && value.length === 12) {
    value = value.slice(2);
  } else if (value.startsWith("0") && value.length === 11) {
    value = value.slice(1);
  }

  if (!/^\d+$/.test(value)) {
    return { ok: false, reason: "Mobile contains non-digit characters." };
  }
  if (!NSN_RE.test(value)) {
    return {
      ok: false,
      reason: "Not a valid Egyptian mobile (expected 01[0125]XXXXXXXX).",
    };
  }

  return { ok: true, e164: `+20${value}`, national: `0${value}` };
}

export function isValidEgyptianMobile(raw: string): boolean {
  return normalizeEgyptianMobile(raw).ok;
}

/** Mask an E.164 mobile for display, e.g. +201001234567 -> +2010••••4567. */
export function maskMobile(e164: string): string {
  if (e164.length < 6) return "••••";
  const head = e164.slice(0, 5);
  const tail = e164.slice(-4);
  return `${head}••••${tail}`;
}
