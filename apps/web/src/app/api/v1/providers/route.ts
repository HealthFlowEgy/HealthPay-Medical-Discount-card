import { requirePartner } from "@/lib/partner-context";
import { getDb } from "@/lib/db";
import { searchProviders, parseProviderQuery } from "@/lib/providers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/providers — search the provider directory (partner auth).
export async function GET(req: Request) {
  try {
    await requirePartner(req);
    const result = await searchProviders(getDb(), parseProviderQuery(req));
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
