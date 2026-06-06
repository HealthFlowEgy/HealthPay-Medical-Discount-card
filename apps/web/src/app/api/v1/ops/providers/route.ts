import { requireOpsUser } from "@/lib/ops-auth";
import { getDb } from "@/lib/db";
import { searchProviders } from "@/lib/providers";
import { parseQuery } from "@/app/api/v1/providers/route";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/providers — provider directory search for the quote builder.
export async function GET(req: Request) {
  try {
    await requireOpsUser();
    const result = await searchProviders(getDb(), parseQuery(req));
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
