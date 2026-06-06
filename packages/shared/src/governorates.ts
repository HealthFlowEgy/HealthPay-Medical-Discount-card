/**
 * The 27 Egyptian governorates.
 *
 * `GOVERNORATES` is the canonical enum used for the `governorate` field on a
 * service request (English keys). `GOVERNORATE_LABELS` maps each to its English
 * and Arabic display label.
 *
 * NOTE: This is the *administrative* list of governorates. It is intentionally
 * separate from the governorate code embedded in a national ID — that historical
 * code set is defined in `national-id.ts` (`NATIONAL_ID_GOVERNORATE_CODES`).
 */

export const GOVERNORATES = [
  "Cairo",
  "Giza",
  "Alexandria",
  "Dakahlia",
  "Red Sea",
  "Beheira",
  "Fayoum",
  "Gharbia",
  "Ismailia",
  "Menofia",
  "Minya",
  "Qalyubia",
  "New Valley",
  "Suez",
  "Aswan",
  "Assiut",
  "Beni Suef",
  "Port Said",
  "Damietta",
  "Sharqia",
  "South Sinai",
  "Kafr El Sheikh",
  "Matrouh",
  "Luxor",
  "Qena",
  "North Sinai",
  "Sohag",
] as const;

export type Governorate = (typeof GOVERNORATES)[number];

export const GOVERNORATE_LABELS: Record<Governorate, { en: string; ar: string }> = {
  Cairo: { en: "Cairo", ar: "القاهرة" },
  Giza: { en: "Giza", ar: "الجيزة" },
  Alexandria: { en: "Alexandria", ar: "الإسكندرية" },
  Dakahlia: { en: "Dakahlia", ar: "الدقهلية" },
  "Red Sea": { en: "Red Sea", ar: "البحر الأحمر" },
  Beheira: { en: "Beheira", ar: "البحيرة" },
  Fayoum: { en: "Fayoum", ar: "الفيوم" },
  Gharbia: { en: "Gharbia", ar: "الغربية" },
  Ismailia: { en: "Ismailia", ar: "الإسماعيلية" },
  Menofia: { en: "Menofia", ar: "المنوفية" },
  Minya: { en: "Minya", ar: "المنيا" },
  Qalyubia: { en: "Qalyubia", ar: "القليوبية" },
  "New Valley": { en: "New Valley", ar: "الوادي الجديد" },
  Suez: { en: "Suez", ar: "السويس" },
  Aswan: { en: "Aswan", ar: "أسوان" },
  Assiut: { en: "Assiut", ar: "أسيوط" },
  "Beni Suef": { en: "Beni Suef", ar: "بني سويف" },
  "Port Said": { en: "Port Said", ar: "بورسعيد" },
  Damietta: { en: "Damietta", ar: "دمياط" },
  Sharqia: { en: "Sharqia", ar: "الشرقية" },
  "South Sinai": { en: "South Sinai", ar: "جنوب سيناء" },
  "Kafr El Sheikh": { en: "Kafr El Sheikh", ar: "كفر الشيخ" },
  Matrouh: { en: "Matrouh", ar: "مطروح" },
  Luxor: { en: "Luxor", ar: "الأقصر" },
  Qena: { en: "Qena", ar: "قنا" },
  "North Sinai": { en: "North Sinai", ar: "شمال سيناء" },
  Sohag: { en: "Sohag", ar: "سوهاج" },
};

const GOVERNORATE_SET = new Set<string>(GOVERNORATES);

export function isGovernorate(value: unknown): value is Governorate {
  return typeof value === "string" && GOVERNORATE_SET.has(value);
}

/**
 * Normalize Arabic text for matching: unify alef-maksura/yaa and taa-marbuta,
 * strip tatweel/diacritics and collapse whitespace.
 */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, "") // diacritics + tatweel
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/[أإآ]/g, "ا") // أ إ آ -> ا
    .replace(/ة/g, "ه") // ة -> ه
    .replace(/\s+/g, " ")
    .trim();
}

// Resolve the canonical governorate from an Arabic label, tolerating the
// spelling variants seen in the provider directory (e.g. "مرسى مطروح", "بنى سويف").
const GOVERNORATE_BY_ARABIC: Map<string, Governorate> = (() => {
  const m = new Map<string, Governorate>();
  for (const g of GOVERNORATES) m.set(normalizeArabic(GOVERNORATE_LABELS[g].ar), g);
  const extra: Record<string, Governorate> = {
    "مرسى مطروح": "Matrouh",
    "بنى سويف": "Beni Suef",
    "الاسكندرية": "Alexandria",
    "القليوبيه": "Qalyubia",
  };
  for (const [ar, g] of Object.entries(extra)) m.set(normalizeArabic(ar), g);
  return m;
})();

export function governorateFromArabic(raw: string): Governorate | undefined {
  return GOVERNORATE_BY_ARABIC.get(normalizeArabic(raw));
}
