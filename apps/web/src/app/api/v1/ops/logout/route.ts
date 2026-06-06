import { clearSessionCookie } from "@/lib/ops-auth";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/ops/logout
export async function POST() {
  try {
    clearSessionCookie();
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
