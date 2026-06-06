/**
 * Egyptian National ID validation & parsing.
 *
 * Format (14 digits): C YY MM DD GG SSSS Z
 *   C    century digit: 2 => 1900–1999, 3 => 2000–2099
 *   YYMMDD  birthdate
 *   GG   governorate code (historical NID code set; see below)
 *   SSSS sequence; the 13th digit's parity encodes gender (odd=male, even=female)
 *   Z    check digit
 *
 * We validate structure, century, a real (non-future) birthdate, and a known
 * governorate code. We do NOT enforce the check digit: there is no reliably
 * documented public checksum algorithm for the Egyptian NID, so enforcing one
 * risks rejecting valid IDs.
 */

/** Valid governorate codes embedded in a national ID (NID historical set, not the admin list). */
export const NATIONAL_ID_GOVERNORATE_CODES: Record<string, string> = {
  "01": "Cairo",
  "02": "Alexandria",
  "03": "Port Said",
  "04": "Suez",
  "11": "Damietta",
  "12": "Dakahlia",
  "13": "Sharqia",
  "14": "Qalyubia",
  "15": "Kafr El Sheikh",
  "16": "Gharbia",
  "17": "Menofia",
  "18": "Beheira",
  "19": "Ismailia",
  "21": "Giza",
  "22": "Beni Suef",
  "23": "Fayoum",
  "24": "Minya",
  "25": "Assiut",
  "26": "Sohag",
  "27": "Qena",
  "28": "Aswan",
  "29": "Luxor",
  "31": "Red Sea",
  "32": "New Valley",
  "33": "Matrouh",
  "34": "North Sinai",
  "35": "South Sinai",
  "88": "Born abroad",
};

export interface ParsedNationalId {
  birthDate: Date;
  centuryDigit: 2 | 3;
  governorateCode: string;
  governorateName: string;
  gender: "male" | "female";
  last4: string;
}

export type NationalIdValidation =
  | { ok: true; parsed: ParsedNationalId }
  | { ok: false; reason: string };

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Validate and parse an Egyptian National ID.
 * Pass `now` to make "not in the future" checks deterministic in tests.
 */
export function validateNationalId(
  raw: string,
  now: Date = new Date(),
): NationalIdValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "National ID must be a string." };
  }
  const value = raw.trim();
  if (!/^\d{14}$/.test(value)) {
    return { ok: false, reason: "National ID must be exactly 14 digits." };
  }

  const centuryDigit = Number(value[0]);
  if (centuryDigit !== 2 && centuryDigit !== 3) {
    return { ok: false, reason: "Century digit must be 2 (1900s) or 3 (2000s)." };
  }
  const centuryBase = centuryDigit === 2 ? 1900 : 2000;

  const yy = Number(value.slice(1, 3));
  const mm = Number(value.slice(3, 5));
  const dd = Number(value.slice(5, 7));
  const year = centuryBase + yy;

  if (!isValidCalendarDate(year, mm, dd)) {
    return { ok: false, reason: "National ID contains an invalid birthdate." };
  }

  const birthDate = new Date(Date.UTC(year, mm - 1, dd));
  if (birthDate.getTime() > now.getTime()) {
    return { ok: false, reason: "National ID birthdate is in the future." };
  }

  const governorateCode = value.slice(7, 9);
  const governorateName = NATIONAL_ID_GOVERNORATE_CODES[governorateCode];
  if (!governorateName) {
    return { ok: false, reason: `Unknown governorate code "${governorateCode}".` };
  }

  const genderDigit = Number(value[12]);
  const gender = genderDigit % 2 === 1 ? "male" : "female";

  return {
    ok: true,
    parsed: {
      birthDate,
      centuryDigit: centuryDigit as 2 | 3,
      governorateCode,
      governorateName,
      gender,
      last4: value.slice(-4),
    },
  };
}

export function isValidNationalId(raw: string, now?: Date): boolean {
  return validateNationalId(raw, now).ok;
}
