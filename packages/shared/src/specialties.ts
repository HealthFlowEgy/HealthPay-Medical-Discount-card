/**
 * Specialties (تخصص مقدم الخدمة) — the secondary matching axis. The directory
 * contains 33 distinct Arabic specialty strings (with spelling variants and
 * compound entries); we normalize them to a smaller canonical set with bilingual
 * labels. The original raw Arabic string is preserved on each provider row, so
 * no source data is lost even when several variants fold into one canonical key.
 */

import type { BilingualLabel } from "./locale.js";

export const SPECIALTIES = [
  "labs",
  "general_hospitals",
  "dentistry",
  "physiotherapy",
  "radiology",
  "outpatient_clinics",
  "pediatrics",
  "orthopedic_surgery",
  "ophthalmology",
  "cardiology",
  "obstetrics_gynecology",
  "ent",
  "dermatology",
  "internal_medicine",
  "general_surgery",
  "gastroenterology",
  "neurosurgery",
  "neurology",
  "nephrology_urology",
  "dental_maxillofacial_radiology",
  "oncology",
  "pulmonology",
  "vascular_surgery",
  "endocrinology",
  "cardiothoracic_surgery",
  "rheumatology_rehab",
] as const;

export type Specialty = (typeof SPECIALTIES)[number];

export const SPECIALTY_LABELS: Record<Specialty, BilingualLabel> = {
  labs: { en: "Labs", ar: "معامل تحاليل" },
  general_hospitals: { en: "General hospitals", ar: "مستشفيات عامة" },
  dentistry: { en: "Dentistry", ar: "أسنان" },
  physiotherapy: { en: "Physiotherapy", ar: "علاج طبيعي" },
  radiology: { en: "Radiology", ar: "مراكز أشعة" },
  outpatient_clinics: { en: "Outpatient clinics", ar: "مراكز عيادات خارجية" },
  pediatrics: { en: "Pediatrics", ar: "أطفال" },
  orthopedic_surgery: { en: "Orthopedic surgery", ar: "جراحة عظام" },
  ophthalmology: { en: "Ophthalmology", ar: "عيون" },
  cardiology: { en: "Cardiology", ar: "قلب وأوعية دموية" },
  obstetrics_gynecology: { en: "Obstetrics & gynecology", ar: "نساء وتوليد" },
  ent: { en: "ENT", ar: "أنف وأذن وحنجرة" },
  dermatology: { en: "Dermatology", ar: "جلدية وتناسلية" },
  internal_medicine: { en: "Internal medicine", ar: "باطنة" },
  general_surgery: { en: "General surgery", ar: "جراحة عامة" },
  gastroenterology: { en: "Gastroenterology", ar: "جهاز هضمي" },
  neurosurgery: { en: "Neurosurgery", ar: "جراحة المخ والأعصاب" },
  neurology: { en: "Neurology", ar: "مخ وأعصاب" },
  nephrology_urology: { en: "Nephrology & urology", ar: "كلى ومسالك بولية" },
  dental_maxillofacial_radiology: {
    en: "Dental & maxillofacial radiology",
    ar: "أشعة الفك والأسنان",
  },
  oncology: { en: "Oncology", ar: "علاج أورام" },
  pulmonology: { en: "Pulmonology", ar: "صدر" },
  vascular_surgery: { en: "Vascular surgery", ar: "جراحة أوعية دموية" },
  endocrinology: { en: "Endocrinology & diabetes", ar: "غدد صماء وسكر" },
  cardiothoracic_surgery: { en: "Cardiothoracic surgery", ar: "جراحة القلب والصدر" },
  rheumatology_rehab: { en: "Rheumatology & rehabilitation", ar: "روماتيزم وتأهيل" },
};

/** Every raw directory Arabic string → canonical specialty key. */
const SPECIALTY_BY_ARABIC: Record<string, Specialty> = {
  "معامل تحاليل": "labs",
  "مستشفيات عامة": "general_hospitals",
  "أسنان": "dentistry",
  "علاج طبيعي": "physiotherapy",
  "مراكز أشعة": "radiology",
  "مركز اشعة": "radiology",
  "مراكز عيادات خارجية": "outpatient_clinics",
  "أطفال": "pediatrics",
  "جراحة عظام": "orthopedic_surgery",
  "جراحات العظام والمخ والاعصاب": "orthopedic_surgery",
  "عيون": "ophthalmology",
  "قلب وأوعية دموية": "cardiology",
  "نسا وتوليد": "obstetrics_gynecology",
  "أنف واذن وحنجرة": "ent",
  "جلدية وتناسلية": "dermatology",
  "باطنة": "internal_medicine",
  "جراحة عامة": "general_surgery",
  "جراحة عامة وجراحة مناظير": "general_surgery",
  "مستشفى متخصص جراحة": "general_surgery",
  "جهاز هضمي": "gastroenterology",
  "باطنة وجهاز هضمى": "gastroenterology",
  "جراحة المخ و الأعصاب": "neurosurgery",
  "مخ و أعصاب": "neurology",
  "كلى و مسالك بولية": "nephrology_urology",
  "مسالك بولية": "nephrology_urology",
  "مراكز اشعة الفك والاسنان": "dental_maxillofacial_radiology",
  "علاج أورام": "oncology",
  "جراحة اورام": "oncology",
  "صدر": "pulmonology",
  "جراحة أوعية دموية": "vascular_surgery",
  "باطنة و غدد صماء و سكر": "endocrinology",
  "جراحة القلب والصدر": "cardiothoracic_surgery",
  "روماتيزم و تأهيل و طب طبيعى": "rheumatology_rehab",
};

const SPECIALTY_SET = new Set<string>(SPECIALTIES);

export function isSpecialty(v: unknown): v is Specialty {
  return typeof v === "string" && SPECIALTY_SET.has(v);
}

/** Resolve a raw Arabic specialty string to a canonical key (or undefined). */
export function specialtyFromArabic(raw: string): Specialty | undefined {
  return SPECIALTY_BY_ARABIC[raw.trim()];
}
