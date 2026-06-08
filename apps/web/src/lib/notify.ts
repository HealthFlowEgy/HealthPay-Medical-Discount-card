/**
 * Operations notifications. On each new client request a message is sent to the
 * call-center number. Today this goes over SMS (CEQUENS); the channel is
 * isolated here so a WhatsApp adapter can replace it once a WhatsApp Business
 * (WABA) sender + approved template are available — only this module changes.
 */

import { eq } from "drizzle-orm";
import type { Database, ServiceRequest } from "@healthpay/db";
import { providers } from "@healthpay/db/schema";
import { PROVIDER_TYPE_LABELS, GOVERNORATE_LABELS, type ProviderType } from "@healthpay/shared";
import { dispatchSms } from "./sms/dispatch.js";
import { env } from "./env.js";

export async function notifyNewClientRequest(
  db: Database,
  request: ServiceRequest,
): Promise<void> {
  const to = env.callCenterPhone;
  if (!to) return; // not configured

  let providerName: string | null = null;
  if (request.providerId) {
    const [p] = await db
      .select({ name: providers.name })
      .from(providers)
      .where(eq(providers.id, request.providerId))
      .limit(1);
    providerName = p?.name ?? null;
  }
  const provider =
    providerName ??
    (request.providerType
      ? PROVIDER_TYPE_LABELS[request.providerType as ProviderType].ar
      : "");
  const gov = GOVERNORATE_LABELS[request.governorate as keyof typeof GOVERNORATE_LABELS]?.ar ?? request.governorate;

  const body =
    `طلب جديد على هيلث باي\n` +
    `العميل: ${request.memberNameAr ?? "—"}\n` +
    `الهاتف: ${request.mobileE164}\n` +
    `المحافظة: ${gov}${request.area ? " - " + request.area : ""}\n` +
    `مقدم الخدمة: ${provider}\n` +
    `الخدمات: ${request.requestedServices ?? "—"}`;

  try {
    await dispatchSms(db, { to, body, requestId: request.id });
  } catch (err) {
    console.error("Call-center notification failed:", err);
  }
}
