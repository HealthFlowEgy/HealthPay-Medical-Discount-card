import { NextResponse } from "next/server";
import { getClient } from "@/lib/healthpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/orders/:id/confirm — partner-side programmatic confirmation via the SDK.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { optionId } = await req.json();
    if (!optionId) return NextResponse.json({ error: "optionId required" }, { status: 400 });
    const hp = getClient();
    const updated = await hp.requests.confirm(params.id, optionId);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to confirm";
    const status = (err as { status?: number })?.status ?? 409;
    return NextResponse.json({ error: message }, { status });
  }
}
