/**
 * Pricing-option validation.
 *
 * HealthPay's discount band is 15%–70%. A pricing option must have a positive
 * list price, a discounted price strictly below it, and a resulting discount
 * within the band.
 */

export const MIN_DISCOUNT_PCT = 15;
export const MAX_DISCOUNT_PCT = 70;
export const DEFAULT_CURRENCY = "EGP";

export type PricingValidation =
  | { ok: true; discountPct: number }
  | { ok: false; reason: string };

/** Discount percentage, rounded to 2 decimals. */
export function computeDiscountPct(listPrice: number, discountedPrice: number): number {
  return Math.round(((listPrice - discountedPrice) / listPrice) * 10000) / 100;
}

export function validatePricing(
  listPrice: number,
  discountedPrice: number,
): PricingValidation {
  if (!Number.isFinite(listPrice) || !Number.isFinite(discountedPrice)) {
    return { ok: false, reason: "Prices must be finite numbers." };
  }
  if (listPrice <= 0 || discountedPrice <= 0) {
    return { ok: false, reason: "Prices must be positive." };
  }
  if (discountedPrice >= listPrice) {
    return { ok: false, reason: "Discounted price must be lower than the list price." };
  }

  const discountPct = computeDiscountPct(listPrice, discountedPrice);
  if (discountPct < MIN_DISCOUNT_PCT || discountPct > MAX_DISCOUNT_PCT) {
    return {
      ok: false,
      reason: `Discount must be between ${MIN_DISCOUNT_PCT}% and ${MAX_DISCOUNT_PCT}% (got ${discountPct}%).`,
    };
  }
  return { ok: true, discountPct };
}
