/**
 * Provider types (نوع مقدم الخدمة) — the primary service-matching axis from the
 * HealthPay provider directory. There are 8 canonical types. Each carries a
 * bilingual label and maps to the legacy 4-value `serviceType` for back-compat.
 */

import type { BilingualLabel } from "./locale.js";
import type { ServiceType } from "./service-type.js";

export const PROVIDER_TYPES = [
  "labs",
  "hospital",
  "dental_clinics",
  "physiotherapy_centers",
  "doctors_clinics",
  "radiology_centers",
  "outpatient_clinic_centers",
  "specialized_centers_outpatient",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const PROVIDER_TYPE_LABELS: Record<ProviderType, BilingualLabel> = {
  labs: { en: "Labs", ar: "معامل تحاليل" },
  hospital: { en: "Hospital", ar: "مستشفى" },
  dental_clinics: { en: "Dental clinics", ar: "عيادات الأسنان" },
  physiotherapy_centers: { en: "Physiotherapy centers", ar: "مراكز العلاج الطبيعي" },
  doctors_clinics: { en: "Doctors' clinics", ar: "عيادات الأطباء" },
  radiology_centers: { en: "Radiology centers", ar: "مراكز اشعة" },
  outpatient_clinic_centers: { en: "Outpatient clinic centers", ar: "مراكز عيادات خارجية" },
  specialized_centers_outpatient: {
    en: "Specialized centers (outpatient)",
    ar: "مراكز متخصصة - خارجي",
  },
};

/** Exact Arabic strings from the directory → canonical provider-type key. */
const PROVIDER_TYPE_BY_ARABIC: Record<string, ProviderType> = {
  "معامل تحاليل": "labs",
  "مستشفى": "hospital",
  "عيادات الأسنان": "dental_clinics",
  "مراكز العلاج الطبيعي": "physiotherapy_centers",
  "عيادات الأطباء": "doctors_clinics",
  "مراكز اشعة": "radiology_centers",
  "مراكز عيادات خارجية": "outpatient_clinic_centers",
  "مراكز متخصصة - خارجي": "specialized_centers_outpatient",
};

const PROVIDER_TYPE_SET = new Set<string>(PROVIDER_TYPES);

export function isProviderType(v: unknown): v is ProviderType {
  return typeof v === "string" && PROVIDER_TYPE_SET.has(v);
}

export function providerTypeFromArabic(raw: string): ProviderType | undefined {
  return PROVIDER_TYPE_BY_ARABIC[raw.trim()];
}

/** Legacy serviceType ↔ providerType bridges (kept for back-compat). */
export function serviceTypeToProviderType(s: ServiceType): ProviderType {
  switch (s) {
    case "lab_investigation":
      return "labs";
    case "radiology_investigation":
      return "radiology_centers";
    case "dental_clinic_visit":
      return "dental_clinics";
    case "medical_clinic_visit":
      return "doctors_clinics";
  }
}

export function providerTypeToServiceType(p: ProviderType): ServiceType {
  switch (p) {
    case "labs":
      return "lab_investigation";
    case "radiology_centers":
      return "radiology_investigation";
    case "dental_clinics":
      return "dental_clinic_visit";
    case "hospital":
    case "physiotherapy_centers":
    case "doctors_clinics":
    case "outpatient_clinic_centers":
    case "specialized_centers_outpatient":
      return "medical_clinic_visit";
  }
}
