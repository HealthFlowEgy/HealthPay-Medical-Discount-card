import { describe, it, expect } from "vitest";
import { validateNationalId, isValidNationalId } from "../national-id.js";

// Reference "now" so future-date checks are deterministic.
const NOW = new Date(Date.UTC(2026, 5, 6));

describe("validateNationalId", () => {
  it("accepts a valid 2000s-century ID and parses its parts", () => {
    // 3 01 01 01 01 2345 6 => born 2001-01-01, governorate 01 (Cairo)
    const res = validateNationalId("30101010123456", NOW);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.parsed.centuryDigit).toBe(3);
      expect(res.parsed.governorateCode).toBe("01");
      expect(res.parsed.governorateName).toBe("Cairo");
      expect(res.parsed.last4).toBe("3456");
      expect(res.parsed.birthDate.getUTCFullYear()).toBe(2001);
    }
  });

  it("accepts a valid 1900s-century ID", () => {
    // 2 90 01 01 21 1234 5 => born 1990-01-01, governorate 21 (Giza)
    const res = validateNationalId("29001012112345", NOW);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.parsed.birthDate.getUTCFullYear()).toBe(1990);
      expect(res.parsed.governorateName).toBe("Giza");
    }
  });

  it("derives gender from the 13th digit parity", () => {
    const male = validateNationalId("30101010123456", NOW); // 13th digit 5 (odd)
    const female = validateNationalId("30101010123446", NOW); // 13th digit 4 (even)
    expect(male.ok && male.parsed.gender).toBe("male");
    expect(female.ok && female.parsed.gender).toBe("female");
  });

  it("rejects non-14-digit input", () => {
    expect(validateNationalId("123", NOW).ok).toBe(false);
    expect(validateNationalId("301010101234567", NOW).ok).toBe(false);
    expect(validateNationalId("3010101012345a", NOW).ok).toBe(false);
  });

  it("rejects an invalid century digit", () => {
    const res = validateNationalId("10101010123456", NOW); // century 1
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/century/i);
  });

  it("rejects an invalid month", () => {
    const res = validateNationalId("30113010123456", NOW); // month 13
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/birthdate/i);
  });

  it("rejects Feb 30 (impossible day)", () => {
    const res = validateNationalId("30102300123456", NOW); // 2001-02-30
    expect(res.ok).toBe(false);
  });

  it("rejects a future birthdate", () => {
    // 2099-01-01 relative to NOW=2026
    const res = validateNationalId("39901010123456", NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/future/i);
  });

  it("rejects an unknown governorate code", () => {
    const res = validateNationalId("30101019923456", NOW); // code 99
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/governorate/i);
  });

  it("accepts code 88 (born abroad)", () => {
    const res = validateNationalId("30101018823456", NOW);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.parsed.governorateName).toBe("Born abroad");
  });

  it("isValidNationalId is a thin boolean wrapper", () => {
    expect(isValidNationalId("30101010123456", NOW)).toBe(true);
    expect(isValidNationalId("bad", NOW)).toBe(false);
  });
});
