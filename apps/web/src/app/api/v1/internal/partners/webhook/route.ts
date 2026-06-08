import { eq } from "drizzle-orm";
import { partners } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import { env } from "@/lib/env";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Set a partner's webhook URL.  POST  Authorization: Bearer <CRON_SECRET>
 * Body: { apiKey?: string, partnerId?: string, webhookUrl: string }
 * (Admin utility — e.g. to point the demo partner's webhooks at the demo app.)
 */
export async function POST(req: Request) {
  try {
    if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
      return json({ error: { code: "auth_error", message: "Unauthorized" } }, { status: 401 });
    }
    const { apiKey, partnerId, webhookUrl } = await req.json();
    if (!webhookUrl || typeof webhookUrl !== "string") {
      return json({ error: { code: "validation_error", message: "webhookUrl required" } }, { status: 422 });
    }
    const db = getDb();
    const where = apiKey
      ? eq(partners.apiKeyHash, sha256Hex(apiKey))
      : partnerId
        ? eq(partners.id, partnerId)
        : null;
    if (!where) {
      return json({ error: { code: "validation_error", message: "apiKey or partnerId required" } }, { status: 422 });
    }
    const [updated] = await db
      .update(partners)
      .set({ webhookUrl })
      .where(where)
      .returning({ id: partners.id, name: partners.name, webhookUrl: partners.webhookUrl });
    if (!updated) {
      return json({ error: { code: "not_found", message: "Partner not found" } }, { status: 404 });
    }
    return json({ ok: true, partner: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
