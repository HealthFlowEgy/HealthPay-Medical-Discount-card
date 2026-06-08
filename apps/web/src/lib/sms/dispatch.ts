/**
 * SMS dispatch: records every send in `sms_messages`, requests a delivery
 * receipt, and (best-effort) never throws — SMS failures must not block the
 * request flow. The DLR webhook (`/api/v1/internal/sms/dlr`) updates the row.
 */

import { eq } from "drizzle-orm";
import type { Database } from "@healthpay/db";
import { smsMessages } from "@healthpay/db/schema";
import { getSmsProvider } from "./index.js";
import { env } from "../env.js";
import { sha256Hex } from "../crypto.js";

/** A token (derived from CRON_SECRET) that authenticates inbound DLR callbacks. */
export function dlrToken(): string {
  return env.cronSecret ? sha256Hex(`${env.cronSecret}:sms-dlr`).slice(0, 32) : "";
}

export type SmsDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "undelivered"
  | "unknown";

/** Map a provider's free-form DLR status string to our enum. */
export function mapDlrStatus(raw: string | undefined | null): SmsDeliveryStatus {
  const s = (raw ?? "").toString().toLowerCase();
  // Order matters: "undeliv" contains "deliv", so check it first.
  if (/undeliv/.test(s)) return "undelivered";
  if (/deliv|dlvrd/.test(s)) return "delivered";
  if (/fail|reject|expired|error/.test(s)) return "failed";
  if (/sent|enroute|accept/.test(s)) return "sent";
  return "unknown";
}

export interface DispatchResult {
  id: string;
  clientMessageId: string;
  status: SmsDeliveryStatus;
  providerMessageId?: string | null;
  error?: string;
}

/** Record + send an SMS. Returns the row id and resulting status. */
export async function dispatchSms(
  db: Database,
  opts: { to: string; body: string; requestId?: string | null },
): Promise<DispatchResult> {
  const provider = getSmsProvider();
  const clientMessageId = String(Math.floor(Math.random() * 2_000_000_000) + 1);

  const [row] = await db
    .insert(smsMessages)
    .values({
      requestId: opts.requestId ?? null,
      provider: provider.name,
      recipient: opts.to,
      clientMessageId,
      status: "pending",
    })
    .returning();

  const base = env.appBaseUrl.replace(/\/$/, "");
  const tok = dlrToken();
  const dlrUrl = tok
    ? `${base}/api/v1/internal/sms/dlr?k=${tok}&c=${clientMessageId}`
    : undefined;

  try {
    const result = await provider.send({
      to: opts.to,
      body: opts.body,
      clientMessageId,
      dlrUrl,
    });
    await db
      .update(smsMessages)
      .set({
        status: "sent",
        providerMessageId: result.providerMessageId ?? null,
        rawResponse: (result.raw as object) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(smsMessages.id, row!.id));
    return { id: row!.id, clientMessageId, status: "sent", providerMessageId: result.providerMessageId ?? null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db
      .update(smsMessages)
      .set({ status: "failed", error, updatedAt: new Date() })
      .where(eq(smsMessages.id, row!.id));
    console.error("SMS send failed:", err);
    return { id: row!.id, clientMessageId, status: "failed", error };
  }
}

/** Compose + dispatch the quote-page SMS (Arabic-first for the Egyptian audience). */
export async function sendQuoteLinkSms(
  db: Database,
  requestId: string,
  to: string,
  quoteUrl: string,
): Promise<void> {
  const body = `هيلث باي: عروض أسعار الخصم الطبي جاهزة. اعرض واختر الخيار المناسب: ${quoteUrl}`;
  await dispatchSms(db, { to, body, requestId });
}
