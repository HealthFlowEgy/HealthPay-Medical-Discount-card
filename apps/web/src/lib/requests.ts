/** Service layer: create / fetch / quote / confirm / cancel / expire requests. */

import { and, eq, desc } from "drizzle-orm";
import {
  computeDiscountPct,
  validatePricing,
  validateNationalId,
  serviceTypeToProviderType,
  providerTypeToServiceType,
  ValidationError,
  NotFoundError,
  ConflictError,
  type CreateRequestParsed,
  type PricingOptionInput,
} from "@healthpay/shared";
import { encryptPii, type Database, type Partner, type ServiceRequest } from "@healthpay/db";
import {
  serviceRequests,
  pricingOptions,
  confirmations,
} from "@healthpay/db/schema";
import { createQuoteToken, hashQuoteToken, buildQuoteUrl } from "./tokens.js";
import { sendQuoteLinkSms } from "./sms/dispatch.js";
import { transitionRequest } from "./transitions.js";
import { writeAudit } from "./audit.js";
import { publishOpsEvent } from "./events.js";

export interface CreatedRequest {
  request: ServiceRequest;
  quoteUrl: string;
}

/** Create a service request in PENDING_QUOTE and dispatch the quote-link SMS. */
export async function createServiceRequest(
  db: Database,
  partner: Partner,
  input: CreateRequestParsed,
): Promise<CreatedRequest> {
  const { token, tokenHash, expiresAt } = createQuoteToken();

  // Resolve the matching axes: providerType is primary; serviceType is the
  // back-compat alias. Derive whichever is missing so both stay consistent.
  const providerType =
    input.providerType ??
    (input.serviceType ? serviceTypeToProviderType(input.serviceType) : undefined);
  const serviceType =
    input.serviceType ?? (providerType ? providerTypeToServiceType(providerType) : undefined);
  if (!serviceType || !providerType) {
    throw new ValidationError("Provide either `providerType` or `serviceType`.");
  }

  // Gender can be supplied or derived from the validated national ID.
  const nid = validateNationalId(input.nationalId);
  const gender = input.gender ?? (nid.ok ? nid.parsed.gender : undefined);

  const [request] = await db
    .insert(serviceRequests)
    .values({
      partnerId: partner.id,
      serviceType,
      providerType,
      specialty: input.specialty,
      governorate: input.governorate,
      area: input.area,
      city: input.city,
      lat: input.lat,
      lng: input.lng,
      providerId: input.providerId,
      nationalIdEncrypted: encryptPii(input.nationalId),
      nationalIdLast4: input.nationalId.slice(-4),
      mobileEncrypted: encryptPii(input.mobile),
      mobileE164: input.mobile,
      memberNameEn: input.memberNameEn,
      memberNameAr: input.memberNameAr,
      company: input.company,
      gender,
      maritalStatus: input.maritalStatus,
      status: "pending_quote",
      partnerReference: input.partnerReference,
      note: input.note,
      quoteTokenHash: tokenHash,
      quoteExpiresAt: expiresAt,
    })
    .returning();
  if (!request) throw new Error("Failed to create service request.");

  await writeAudit(db, {
    actorType: "partner",
    actorId: partner.id,
    action: "request.created",
    requestId: request.id,
    metadata: { serviceType: request.serviceType, governorate: request.governorate },
  });

  publishOpsEvent({
    type: "request.created",
    requestId: request.id,
    status: request.status,
    at: new Date().toISOString(),
  });

  const quoteUrl = buildQuoteUrl(token);
  // Best-effort SMS; dispatchSms records + never throws, but guard anyway.
  try {
    await sendQuoteLinkSms(db, request.id, request.mobileE164, quoteUrl);
  } catch (err) {
    console.error("Quote SMS failed:", err);
  }

  return { request, quoteUrl };
}

export async function getRequestById(
  db: Database,
  id: string,
): Promise<ServiceRequest | undefined> {
  const [row] = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id))
    .limit(1);
  return row;
}

/** Look up a request by its hosted-page token (compared by hash). */
export async function getRequestByToken(
  db: Database,
  token: string,
): Promise<ServiceRequest | undefined> {
  const [row] = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.quoteTokenHash, hashQuoteToken(token)))
    .limit(1);
  return row;
}

export async function getOptions(db: Database, requestId: string) {
  return db
    .select()
    .from(pricingOptions)
    .where(eq(pricingOptions.requestId, requestId))
    .orderBy(desc(pricingOptions.discountPct));
}

export async function getConfirmation(db: Database, requestId: string) {
  const [row] = await db
    .select()
    .from(confirmations)
    .where(eq(confirmations.requestId, requestId))
    .limit(1);
  return row;
}

/** Attach one or more pricing options and move the request to QUOTED. */
export async function attachOptions(
  db: Database,
  request: ServiceRequest,
  options: PricingOptionInput[],
  opsUserId: string,
): Promise<ServiceRequest> {
  if (request.status !== "pending_quote" && request.status !== "quoted") {
    throw new ConflictError(`Cannot attach options to a ${request.status} request.`);
  }

  const values = options.map((o) => {
    const res = validatePricing(o.listPrice, o.discountedPrice);
    if (!res.ok) throw new ValidationError(res.reason);
    return {
      requestId: request.id,
      providerId: o.providerId,
      providerName: o.providerName,
      providerAddress: o.providerAddress,
      serviceDescription: o.serviceDescription,
      listPrice: o.listPrice.toFixed(2),
      discountedPrice: o.discountedPrice.toFixed(2),
      discountPct: computeDiscountPct(o.listPrice, o.discountedPrice).toFixed(2),
      currency: o.currency ?? "EGP",
      validityNote: o.validityNote,
      extraInfo: o.extraInfo,
      createdBy: opsUserId,
    };
  });

  await db.insert(pricingOptions).values(values);

  // First time we attach → pending_quote -> quoted. Subsequent adds stay quoted.
  if (request.status === "pending_quote") {
    return transitionRequest(db, request, "quoted", {
      actorType: "ops",
      actorId: opsUserId,
      metadata: { optionCount: values.length },
    });
  }
  await writeAudit(db, {
    actorType: "ops",
    actorId: opsUserId,
    action: "request.options.added",
    requestId: request.id,
    metadata: { optionCount: values.length },
  });
  return request;
}

/** Remove an option while the request is still QUOTED and unconfirmed. */
export async function removeOption(
  db: Database,
  optionId: string,
  opsUserId: string,
): Promise<void> {
  const [opt] = await db
    .select()
    .from(pricingOptions)
    .where(eq(pricingOptions.id, optionId))
    .limit(1);
  if (!opt) throw new NotFoundError("Pricing option not found.");

  const request = await getRequestById(db, opt.requestId);
  if (!request) throw new NotFoundError("Request not found.");
  if (request.status !== "quoted") {
    throw new ConflictError(`Cannot remove options from a ${request.status} request.`);
  }

  await db.delete(pricingOptions).where(eq(pricingOptions.id, optionId));
  await writeAudit(db, {
    actorType: "ops",
    actorId: opsUserId,
    action: "request.option.removed",
    requestId: request.id,
    metadata: { optionId },
  });
}

/** Confirm a quote by selecting exactly one option. */
export async function confirmRequest(
  db: Database,
  request: ServiceRequest,
  optionId: string,
  source: "hosted_page" | "sdk",
  actor: { actorType: "user" | "partner"; actorId?: string | null },
): Promise<ServiceRequest> {
  if (request.status !== "quoted") {
    throw new ConflictError(`Request is ${request.status}; only quoted requests can be confirmed.`);
  }
  if (request.quoteExpiresAt.getTime() <= Date.now()) {
    // Lazily expire and reject.
    await transitionRequest(db, request, "expired", {
      actorType: "system",
      metadata: { reason: "expired_on_confirm" },
    });
    throw new ConflictError("This quote has expired.");
  }

  const [option] = await db
    .select()
    .from(pricingOptions)
    .where(and(eq(pricingOptions.id, optionId), eq(pricingOptions.requestId, request.id)))
    .limit(1);
  if (!option) throw new NotFoundError("Selected option does not belong to this request.");

  await db.insert(confirmations).values({
    requestId: request.id,
    selectedOptionId: option.id,
    confirmedFrom: source,
  });

  return transitionRequest(db, request, "confirmed", {
    actorType: actor.actorType,
    actorId: actor.actorId,
    metadata: { selectedOptionId: option.id, source },
  });
}

/** Cancel a request (partner or user). */
export async function cancelRequest(
  db: Database,
  request: ServiceRequest,
  actor: { actorType: "partner" | "user" | "ops"; actorId?: string | null },
): Promise<ServiceRequest> {
  return transitionRequest(db, request, "cancelled", {
    actorType: actor.actorType,
    actorId: actor.actorId,
  });
}

/** Lazily expire a quoted request whose validity window has passed. */
export async function expireRequestIfDue(
  db: Database,
  request: ServiceRequest,
): Promise<ServiceRequest> {
  if (request.status === "quoted" && request.quoteExpiresAt.getTime() <= Date.now()) {
    return transitionRequest(db, request, "expired", {
      actorType: "system",
      metadata: { reason: "validity_elapsed" },
    });
  }
  return request;
}
