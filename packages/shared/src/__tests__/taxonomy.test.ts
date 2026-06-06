import { describe, it, expect } from "vitest";
import {
  PROVIDER_TYPES,
  providerTypeFromArabic,
  serviceTypeToProviderType,
  providerTypeToServiceType,
} from "../provider-types.js";
import { SPECIALTIES, specialtyFromArabic, SPECIALTY_LABELS } from "../specialties.js";
import { governorateFromArabic } from "../governorates.js";
import { label, dir } from "../locale.js";
import { GENDER_LABELS, MARITAL_STATUS_LABELS } from "../member.js";

describe("provider types", () => {
  it("has 8 canonical types and maps Arabic strings", () => {
    expect(PROVIDER_TYPES).toHaveLength(8);
    expect(providerTypeFromArabic("معامل تحاليل")).toBe("labs");
    expect(providerTypeFromArabic("مراكز العلاج الطبيعي")).toBe("physiotherapy_centers");
    expect(providerTypeFromArabic("nope")).toBeUndefined();
  });

  it("bridges to/from legacy serviceType", () => {
    expect(serviceTypeToProviderType("lab_investigation")).toBe("labs");
    expect(providerTypeToServiceType("physiotherapy_centers")).toBe("medical_clinic_visit");
    expect(providerTypeToServiceType("radiology_centers")).toBe("radiology_investigation");
  });
});

describe("specialties", () => {
  it("normalizes raw Arabic variants to canonical keys", () => {
    expect(specialtyFromArabic("أسنان")).toBe("dentistry");
    expect(specialtyFromArabic("مركز اشعة")).toBe("radiology");
    expect(specialtyFromArabic("مراكز أشعة")).toBe("radiology");
    expect(specialtyFromArabic("مسالك بولية")).toBe("nephrology_urology");
    expect(specialtyFromArabic("جراحة اورام")).toBe("oncology");
  });

  it("every canonical specialty has both labels", () => {
    for (const s of SPECIALTIES) {
      expect(SPECIALTY_LABELS[s].en.length).toBeGreaterThan(0);
      expect(SPECIALTY_LABELS[s].ar.length).toBeGreaterThan(0);
    }
  });
});

describe("governorate Arabic resolver", () => {
  it("resolves canonical and variant spellings", () => {
    expect(governorateFromArabic("القاهرة")).toBe("Cairo");
    expect(governorateFromArabic("مرسى مطروح")).toBe("Matrouh");
    expect(governorateFromArabic("بنى سويف")).toBe("Beni Suef"); // alef maksura variant
    expect(governorateFromArabic("الجيزة")).toBe("Giza");
  });
  it("returns undefined for unknown", () => {
    expect(governorateFromArabic("Atlantis")).toBeUndefined();
  });
});

describe("locale helpers", () => {
  it("picks labels by locale and resolves direction", () => {
    expect(label(GENDER_LABELS.female, "ar")).toBe("أنثى");
    expect(label(GENDER_LABELS.female, "en")).toBe("Female");
    expect(label(MARITAL_STATUS_LABELS.married, "ar")).toBe("متزوج");
    expect(dir("ar")).toBe("rtl");
    expect(dir("en")).toBe("ltr");
  });
});
