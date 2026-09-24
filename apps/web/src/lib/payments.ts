/**
 * Payments recorded against a request.
 *
 * The third-party app collects the money via its OWN payment provider, then
 * reports the outcome here. HealthPay never touches card data — it only records
 * the result, validates the amount against the picked offer, and surfaces it in
 * the ops portal.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { ConflictError, NotFoundError, ValidationError } from "@healthpay/shared";
import type { Database, Payment, PricingOption, ServiceRequest } from "@healthpay/db";
import { payments, pricingOptions } from "@healthpay/db/schema";
import { writeAudit, type ActorType } from "./audit.js";
import { publishOpsEvent } from "./events.js";

export interface RecordPaymentInput {
  optionId?: string;
  amount: number;
  currency?: string;
  status: "succeeded" | "failed" | "pending";
  provider?: string;
  providerReference: string;
  paidAt?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

/** Public shape of a payment (safe to return to partners/ops — no card data). */
export function serializePayment(p: Payment) {
  return {
    id: p.id,
    status: p.status,
    amount: Number(p.amount),
    currency: p.currency,
    provider: p.provider,
    providerReference: p.providerReference,
    optionId: p.optionId,
    paidAt: p.paidAt?.toISOString() ?? null,
    failureReason: p.failureReason,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Most recent payment for a request, or null. */
export async function getLatestPayment(db: Database, requestId: string): Promise<Payment | null> {
  const [row] = await db
    .select()
    .from(payments)
    .where(eq(payments.requestId, requestId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Map of requestId → latest payment status, for a batch of requests. Best-effort:
 * returns {} if the payments table isn't migrated yet, so list views never break.
 */
export async function getPaymentStatusMap(
  db: Database,
  requestIds: string[],
): Promise<Record<string, string>> {
  if (requestIds.length === 0) return {};
  try {
    const rows = await db
      .select({ requestId: payments.requestId, status: payments.status })
      .from(payments)
      .where(inArray(payments.requestId, requestIds))
      .orderBy(desc(payments.createdAt));
    const map: Record<string, string> = {};
    for (const r of rows) {
      // Rows are newest-first, so the first seen per request is the latest.
      if (!(r.requestId in map)) map[r.requestId] = r.status;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Record (or idempotently update) a payment the third-party app reports. The
 * amount is authoritative from the selected option — a mismatch is rejected so
 * a client can never record an under/over-charge.
 */
export async function recordPayment(
  db: Database,
  request: ServiceRequest,
  selectedOptionId: string | null,
  input: RecordPaymentInput,
  actor: { actorType: ActorType; actorId?: string | null },
): Promise<Payment> {
  const optionId = input.optionId ?? selectedOptionId;
  if (!optionId) {
    throw new ConflictError(
      "No offer selected for this request. Confirm an offer first, or pass optionId.",
    );
  }

  const [option] = await db
    .select()
    .from(pricingOptions)
    .where(and(eq(pricingOptions.id, optionId), eq(pricingOptions.requestId, request.id)))
    .limit(1);
  if (!option) throw new NotFoundError("Selected option does not belong to this request.");

  assertAmountMatches(option, input);

  const paidAt =
    input.status === "succeeded" ? new Date(input.paidAt ?? Date.now()) : null;

  const values = {
    requestId: request.id,
    optionId: option.id,
    amount: String(input.amount),
    currency: (input.currency ?? option.currency).toUpperCase(),
    status: input.status,
    provider: input.provider ?? null,
    providerReference: input.providerReference,
    paidAt,
    failureReason: input.failureReason ?? null,
    metadata: input.metadata ?? null,
    updatedAt: new Date(),
  };

  // Idempotent on the PSP reference — re-reporting the same transaction updates
  // the same row instead of duplicating it.
  const [payment] = await db
    .insert(payments)
    .values(values)
    .onConflictDoUpdate({ target: payments.providerReference, set: values })
    .returning();
  if (!payment) throw new Error("Failed to record payment.");

  await writeAudit(db, {
    actorType: actor.actorType,
    actorId: actor.actorId,
    action: `payment.${input.status}`,
    requestId: request.id,
    metadata: {
      paymentId: payment.id,
      optionId: option.id,
      amount: input.amount,
      currency: payment.currency,
      provider: input.provider ?? null,
      providerReference: input.providerReference,
    },
  });

  publishOpsEvent({
    type: "request.updated",
    requestId: request.id,
    status: request.status,
    at: new Date().toISOString(),
  });

  return payment;
}

function assertAmountMatches(option: PricingOption, input: RecordPaymentInput): void {
  const expected = Number(option.discountedPrice);
  if (Math.abs(expected - input.amount) > 0.01) {
    throw new ValidationError(
      `Amount ${input.amount} does not match the offer's price ${expected}.`,
      { expected, received: input.amount },
    );
  }
  const currency = (input.currency ?? option.currency).toUpperCase();
  if (currency !== option.currency.toUpperCase()) {
    throw new ValidationError(
      `Currency ${currency} does not match the offer's currency ${option.currency}.`,
    );
  }
}
