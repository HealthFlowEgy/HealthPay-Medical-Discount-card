import { NextResponse } from "next/server";
import { getClient, WEBHOOK_SECRET } from "@/lib/healthpay";
import { recordEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/healthpay/webhook — receives + verifies HealthPay webhooks.
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-hp-webhook-signature") ?? "";
  const ts = req.headers.get("x-hp-webhook-timestamp") ?? "";

  let verified = false;
  try {
    verified = await getClient().webhooks.verify(raw, sig, ts, WEBHOOK_SECRET);
  } catch {
    verified = false;
  }

  let payload: { event?: string; requestId?: string; data?: unknown } = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  recordEvent({
    event: payload.event ?? req.headers.get("x-hp-event") ?? "unknown",
    requestId: payload.requestId ?? null,
    verified,
    data: payload.data,
  });

  // Always 200 so the sender doesn't retry; verification is recorded.
  return NextResponse.json({ received: true, verified });
}
