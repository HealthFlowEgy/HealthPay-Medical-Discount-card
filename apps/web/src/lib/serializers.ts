/** Response serializers — control exactly what each audience can see. */

import { maskMobile } from "@healthpay/shared";
import type { ServiceRequest, PricingOption } from "@healthpay/db";

export function serializeOption(o: PricingOption) {
  return {
    id: o.id,
    providerId: o.providerId,
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
    providerType: r.providerType,
    specialty: r.specialty,
    governorate: r.governorate,
    area: r.area,
    city: r.city,
    providerId: r.providerId,
    mobile: maskMobile(r.mobileE164),
    nationalIdLast4: r.nationalIdLast4,
    memberNameEn: r.memberNameEn,
    memberNameAr: r.memberNameAr,
    company: r.company,
    gender: r.gender,
    maritalStatus: r.maritalStatus,
    partnerReference: r.partnerReference,
    note: r.note,
    expiresAt: r.quoteExpiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    options: options?.map(serializeOption) ?? undefined,
    selectedOptionId: selectedOptionId ?? undefined,
  };
}

/** Client portal view of one of the client's own requests. */
export function serializeRequestForClient(
  r: ServiceRequest,
  options: PricingOption[],
  selectedOptionId?: string | null,
) {
  return {
    id: r.id,
    status: r.status,
    serviceType: r.serviceType,
    providerType: r.providerType,
    specialty: r.specialty,
    governorate: r.governorate,
    area: r.area,
    city: r.city,
    requestedServices: r.requestedServices,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    expiresAt: r.quoteExpiresAt.toISOString(),
    options: options.map(serializeOption),
    selectedOptionId: selectedOptionId ?? null,
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
    providerType: r.providerType,
    specialty: r.specialty,
    governorate: r.governorate,
    area: r.area,
    city: r.city,
    mobile: maskMobile(r.mobileE164),
    // The member is viewing their own quote (token bearer) — greet by name.
    memberNameAr: r.memberNameAr,
    memberNameEn: r.memberNameEn,
    expiresAt: r.quoteExpiresAt.toISOString(),
    options: options.map(serializeOption),
    selectedOptionId: selectedOptionId ?? null,
  };
}
