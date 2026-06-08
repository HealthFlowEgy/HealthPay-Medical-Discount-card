import { and, eq, or } from "drizzle-orm";
import { smsMessages } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { dlrToken, mapDlrStatus } from "@/lib/sms/dispatch";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delivery-receipt callback for SMS providers (e.g. CEQUENS `dlrUrl`). Tolerant
 * of the various field names providers use. Authenticated by the `k` token
 * (derived from CRON_SECRET) embedded in the callback URL. Accepts GET or POST.
 */
async function collectParams(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) out[k] = v;
  if (req.method === "POST") {
    const ct = req.headers.get("content-type") ?? "";
    try {
      if (ct.includes("application/json")) {
        const body = await req.json();
        flatten(body, out);
      } else {
        const text = await req.text();
        for (const [k, v] of new URLSearchParams(text)) out[k] = v;
      }
    } catch {
      /* ignore malformed bodies */
    }
  }
  return out;
}

function flatten(obj: unknown, out: Record<string, string>) {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v && typeof v === "object") flatten(v, out);
    else if (v !== undefined && v !== null) out[k] = String(v);
  }
}

function pick(p: Record<string, string>, keys: string[]): string | undefined {
  for (const k of Object.keys(p)) {
    if (keys.includes(k.toLowerCase())) return p[k];
  }
  return undefined;
}

async function handle(req: Request): Promise<Response> {
  const params = await collectParams(req);
  const expected = dlrToken();
  if (!expected || params.k !== expected) {
    return json({ error: { code: "auth_error", message: "Unauthorized" } }, { status: 401 });
  }

  const clientMessageId = pick(params, ["c", "clientmessageid", "clientid", "clientmsgid"]);
  const providerMessageId = pick(params, ["messageid", "message_id", "id", "cequensmessageid", "msgid"]);
  const statusRaw = pick(params, ["status", "dlrstatus", "state", "deliverystatus", "delivery_status"]);

  if (!clientMessageId && !providerMessageId) {
    return json({ ok: true, matched: false, reason: "no identifier" });
  }

  const db = getDb();
  const where = or(
    clientMessageId ? eq(smsMessages.clientMessageId, clientMessageId) : undefined,
    providerMessageId ? eq(smsMessages.providerMessageId, providerMessageId) : undefined,
  );

  const updated = await db
    .update(smsMessages)
    .set({
      status: mapDlrStatus(statusRaw),
      providerMessageId: providerMessageId ?? undefined,
      dlr: params,
      updatedAt: new Date(),
    })
    .where(and(where))
    .returning({ id: smsMessages.id });

  return json({ ok: true, matched: updated.length > 0, status: mapDlrStatus(statusRaw) });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
