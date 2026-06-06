/**
 * Service categories a partner can request a discount quote for.
 *
 * This is the ONLY medical attribute captured. HealthPay is a discount-pricing
 * tool, not insurance — no diagnosis or clinical data is collected.
 */

export const SERVICE_TYPES = [
  "medical_clinic_visit",
  "dental_clinic_visit",
  "lab_investigation",
  "radiology_investigation",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, { en: string; ar: string }> = {
  medical_clinic_visit: { en: "Medical clinic visit", ar: "زيارة عيادة طبية" },
  dental_clinic_visit: { en: "Dental clinic visit", ar: "زيارة عيادة أسنان" },
  lab_investigation: { en: "Lab investigation", ar: "تحاليل معملية" },
  radiology_investigation: { en: "Radiology investigation", ar: "أشعة" },
};

const SERVICE_TYPE_SET = new Set<string>(SERVICE_TYPES);

export function isServiceType(value: unknown): value is ServiceType {
  return typeof value === "string" && SERVICE_TYPE_SET.has(value);
}
