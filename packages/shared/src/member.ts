/** Member intake attributes (from the "أسئلة اساسية" sheet). */

import type { BilingualLabel } from "./locale.js";

export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, BilingualLabel> = {
  male: { en: "Male", ar: "ذكر" },
  female: { en: "Female", ar: "أنثى" },
};

export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const MARITAL_STATUS_LABELS: Record<MaritalStatus, BilingualLabel> = {
  single: { en: "Single", ar: "أعزب" },
  married: { en: "Married", ar: "متزوج" },
  divorced: { en: "Divorced", ar: "مطلق" },
  widowed: { en: "Widowed", ar: "أرمل" },
};

const GENDER_SET = new Set<string>(GENDERS);
const MARITAL_SET = new Set<string>(MARITAL_STATUSES);

export function isGender(v: unknown): v is Gender {
  return typeof v === "string" && GENDER_SET.has(v);
}
export function isMaritalStatus(v: unknown): v is MaritalStatus {
  return typeof v === "string" && MARITAL_SET.has(v);
}
