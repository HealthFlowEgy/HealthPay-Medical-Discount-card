import { requireOpsUser } from "@/lib/ops-auth";
import { getDb } from "@/lib/db";
import { searchProviders, parseProviderQuery } from "@/lib/providers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/providers — provider directory search for the quote builder.
export async function GET(req: Request) {
  try {
    await requireOpsUser();
    const result = await searchProviders(getDb(), parseProviderQuery(req));
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
