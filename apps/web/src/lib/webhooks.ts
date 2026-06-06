/**
 * Webhook delivery with signing + exponential-backoff retries (max 6 attempts).
 *
 * On a transition we enqueue a `webhook_deliveries` row and attempt delivery
 * immediately. Failed attempts are rescheduled with backoff; a cron-triggered
 * endpoint (`/api/v1/internal/webhooks/process`) drains due retries — the
 * Vercel-friendly alternative to a long-lived background worker.
 *
 * Partners verify authenticity via the `X-HP-Webhook-Signature` header:
 *   hex HMAC-SHA256 over `${timestamp}.${rawBody}` using their webhook_secret,
 * sent alongside `X-HP-Webhook-Timestamp`. The same scheme the SDK verifies.
 */

import { and, eq, lte, or, isNull } from "drizzle-orm";
import type { Database } from "@healthpay/db";
import { partners, webhookDeliveries } from "@healthpay/db/schema";
import { hmacSha256Hex } from "./crypto.js";

export const MAX_WEBHOOK_ATTEMPTS = 6;

/** Backoff schedule (seconds) per attempt number (1-indexed). */
function backoffSeconds(attempt: number): number {
  // 30s, 2m, 8m, 32m, ~2h, ~8.5h
  return 30 * Math.pow(4, attempt - 1);
}

export function signWebhook(
  secret: string,
  timestamp: number,
  rawBody: string,
): string {
  return hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
}

/** Enqueue a delivery and attempt it immediately (best-effort). */
export async function enqueueWebhook(
  db: Database,
  params: { partnerId: string; requestId: string | null; event: string; payload: unknown },
): Promise<void> {
  const [row] = await db
    .insert(webhookDeliveries)
    .values({
      partnerId: params.partnerId,
      requestId: params.requestId,
      event: params.event,
      payload: params.payload as object,
      status: "pending",
      attempts: 0,
    })
    .returning();
  if (row) {
    // Fire-and-forget; failures are persisted for the retry drainer.
    void attemptDelivery(db, row.id).catch(() => {});
  }
}

async function attemptDelivery(db: Database, deliveryId: string): Promise<void> {
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  if (!delivery || delivery.status === "delivered" || delivery.status === "exhausted") {
    return;
  }

  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, delivery.partnerId))
    .limit(1);

  const attempt = delivery.attempts + 1;

  if (!partner?.webhookUrl || !partner.webhookSecret) {
    // No endpoint configured — nothing to deliver to.
    await db
      .update(webhookDeliveries)
      .set({ status: "exhausted", lastError: "No webhook_url configured", updatedAt: new Date() })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const rawBody = JSON.stringify({
    event: delivery.event,
    requestId: delivery.requestId,
    data: delivery.payload,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhook(partner.webhookSecret, timestamp, rawBody);

  try {
    const res = await fetch(partner.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hp-webhook-signature": signature,
        "x-hp-webhook-timestamp": String(timestamp),
        "x-hp-event": delivery.event,
      },
      body: rawBody,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Endpoint responded ${res.status}`);

    await db
      .update(webhookDeliveries)
      .set({ status: "delivered", attempts: attempt, nextRetryAt: null, updatedAt: new Date() })
      .where(eq(webhookDeliveries.id, deliveryId));
  } catch (err) {
    const exhausted = attempt >= MAX_WEBHOOK_ATTEMPTS;
    await db
      .update(webhookDeliveries)
      .set({
        status: exhausted ? "exhausted" : "failed",
        attempts: attempt,
        lastError: err instanceof Error ? err.message : String(err),
        nextRetryAt: exhausted ? null : new Date(Date.now() + backoffSeconds(attempt) * 1000),
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  }
}

/** Drain deliveries whose retry is due. Called by the cron endpoint. */
export async function processDueWebhooks(db: Database, batchSize = 50): Promise<number> {
  const due = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "failed"),
        or(isNull(webhookDeliveries.nextRetryAt), lte(webhookDeliveries.nextRetryAt, new Date())),
      ),
    )
    .limit(batchSize);

  for (const d of due) {
    await attemptDelivery(db, d.id);
  }
  return due.length;
}
