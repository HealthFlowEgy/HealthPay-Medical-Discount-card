/**
 * Egyptian full-name ("الاسم الرباعي") validation. The name must match the
 * national ID card, which uses at least four parts (first + father + grandfather
 * + family). We require ≥4 tokens of Arabic and/or Latin letters.
 */

export type NameValidation = { ok: true } | { ok: false; reason: string };

// Arabic letters + Latin letters + spaces only.
const NAME_TOKEN = /^[\p{Script=Arabic}A-Za-z'.-]{2,}$/u;

export function validateFullName(raw: string): NameValidation {
  if (typeof raw !== "string") return { ok: false, reason: "Name must be a string." };
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 4) {
    return {
      ok: false,
      reason: "Full (quadruple) name is required — at least four parts.",
    };
  }
  for (const tok of tokens) {
    if (!NAME_TOKEN.test(tok)) {
      return { ok: false, reason: "Name may contain letters only." };
    }
  }
  return { ok: true };
}

export function isValidFullName(raw: string): boolean {
  return validateFullName(raw).ok;
}
