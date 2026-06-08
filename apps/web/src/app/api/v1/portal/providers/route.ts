import { getDb } from "@/lib/db";
import { requireClient } from "@/lib/client-auth";
import { searchProviders, parseProviderQuery } from "@/lib/providers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/portal/providers — directory search for the conditional dropdown.
export async function GET(req: Request) {
  try {
    await requireClient();
    const result = await searchProviders(getDb(), parseProviderQuery(req));
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
