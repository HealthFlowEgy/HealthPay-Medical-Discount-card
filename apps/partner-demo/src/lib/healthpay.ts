/** Server-only HealthPay SDK wiring for the demo partner ("MediBook"). */

import { HealthPay } from "@healthpay/quote-sdk";

export function getClient(): HealthPay {
  const apiKey = process.env.HEALTHPAY_API_KEY;
  const apiSecret = process.env.HEALTHPAY_API_SECRET;
  const baseUrl = process.env.HEALTHPAY_BASE_URL;
  if (!apiKey || !apiSecret || !baseUrl) {
    throw new Error(
      "HealthPay SDK not configured (HEALTHPAY_API_KEY / HEALTHPAY_API_SECRET / HEALTHPAY_BASE_URL).",
    );
  }
  return new HealthPay({ apiKey, apiSecret, baseUrl });
}

/** Public HealthPay base URL used to build hosted quote-page links for the browser. */
export const HEALTHPAY_PUBLIC_URL =
  process.env.NEXT_PUBLIC_HEALTHPAY_URL ?? process.env.HEALTHPAY_BASE_URL ?? "";

export const WEBHOOK_SECRET = process.env.HEALTHPAY_WEBHOOK_SECRET ?? "";
