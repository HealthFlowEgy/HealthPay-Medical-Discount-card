import { describe, it, expect } from "vitest";
import { validatePricing, computeDiscountPct } from "../pricing.js";

describe("computeDiscountPct", () => {
  it("computes a rounded percentage", () => {
    expect(computeDiscountPct(1000, 700)).toBe(30);
    expect(computeDiscountPct(300, 199)).toBe(33.67);
  });
});

describe("validatePricing", () => {
  it("accepts a discount inside the 15–70% band", () => {
    const res = validatePricing(1000, 700);
    expect(res.ok && res.discountPct).toBe(30);
  });

  it("accepts the band boundaries (15% and 70%)", () => {
    expect(validatePricing(1000, 850).ok).toBe(true); // 15%
    expect(validatePricing(1000, 300).ok).toBe(true); // 70%
  });

  it("rejects a discount below 15%", () => {
    const res = validatePricing(1000, 900); // 10%
    expect(res.ok).toBe(false);
  });

  it("rejects a discount above 70%", () => {
    const res = validatePricing(1000, 200); // 80%
    expect(res.ok).toBe(false);
  });

  it("rejects discounted >= list", () => {
    expect(validatePricing(1000, 1000).ok).toBe(false);
    expect(validatePricing(1000, 1200).ok).toBe(false);
  });

  it("rejects non-positive or non-finite prices", () => {
    expect(validatePricing(0, 0).ok).toBe(false);
    expect(validatePricing(-100, -50).ok).toBe(false);
    expect(validatePricing(Number.NaN, 50).ok).toBe(false);
  });
});
