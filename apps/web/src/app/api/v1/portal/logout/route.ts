import { clearClientSession } from "@/lib/client-auth";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    clearClientSession();
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
