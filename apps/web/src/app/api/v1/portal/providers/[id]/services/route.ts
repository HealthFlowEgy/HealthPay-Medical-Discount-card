import { getDb } from "@/lib/db";
import { requireClient } from "@/lib/client-auth";
import { getProviderServices } from "@/lib/services";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/portal/providers/:id/services — predefined services for a provider.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireClient();
    const result = await getProviderServices(getDb(), params.id);
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
