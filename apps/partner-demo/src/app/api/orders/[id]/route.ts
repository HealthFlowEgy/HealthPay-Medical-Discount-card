import { NextResponse } from "next/server";
import { getClient } from "@/lib/healthpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/orders/:id — poll the request status via the SDK.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const hp = getClient();
    const request = await hp.requests.get(params.id);
    return NextResponse.json(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
