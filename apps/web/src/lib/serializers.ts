/** Response serializers — control exactly what each audience can see. */

import { maskMobile } from "@healthpay/shared";
import type { ServiceRequest, PricingOption } from "@healthpay/db";

export function serializeOption(o: PricingOption) {
  return {
    id: o.id,
    providerName: o.providerName,
    providerAddress: o.providerAddress,
    serviceDescription: o.serviceDescription,
    listPrice: Number(o.listPrice),
    discountedPrice: Number(o.discountedPrice),
    discountPct: Number(o.discountPct),
    currency: o.currency,
    validityNote: o.validityNote,
    extraInfo: o.extraInfo ?? null,
  };
}

/** Partner-facing request view (no raw PII; mobile masked). */
export function serializeRequestForPartner(
  r: ServiceRequest,
  options?: PricingOption[],
  selectedOptionId?: string | null,
) {
  return {
    id: r.id,
    status: r.status,
    serviceType: r.serviceType,
    governorate: r.governorate,
    city: r.city,
    mobile: maskMobile(r.mobileE164),
    nationalIdLast4: r.nationalIdLast4,
    partnerReference: r.partnerReference,
    note: r.note,
    expiresAt: r.quoteExpiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    options: options?.map(serializeOption) ?? undefined,
    selectedOptionId: selectedOptionId ?? undefined,
  };
}

/** Hosted quote-page view — never exposes the national ID; mobile masked. */
export function serializeRequestForQuotePage(
  r: ServiceRequest,
  options: PricingOption[],
  selectedOptionId?: string | null,
) {
  return {
    id: r.id,
    status: r.status,
    serviceType: r.serviceType,
    governorate: r.governorate,
    city: r.city,
    mobile: maskMobile(r.mobileE164),
    expiresAt: r.quoteExpiresAt.toISOString(),
    options: options.map(serializeOption),
    selectedOptionId: selectedOptionId ?? null,
  };
}
