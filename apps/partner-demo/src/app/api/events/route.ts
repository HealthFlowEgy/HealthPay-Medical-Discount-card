import { NextResponse } from "next/server";
import { recentEvents } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/events — recent webhook events received from HealthPay.
export async function GET() {
  return NextResponse.json({ events: recentEvents() });
}
