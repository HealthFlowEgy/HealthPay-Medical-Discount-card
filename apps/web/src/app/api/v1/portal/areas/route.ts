import { isGovernorate, ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireClient } from "@/lib/client-auth";
import { listAreas } from "@/lib/providers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/portal/areas?governorate= — cascading area dropdown options.
export async function GET(req: Request) {
  try {
    await requireClient();
    const gov = new URL(req.url).searchParams.get("governorate") ?? "";
    if (!isGovernorate(gov)) throw new ValidationError("Unknown governorate.");
    const areas = await listAreas(getDb(), gov);
    return json({ areas });
  } catch (err) {
    return errorResponse(err);
  }
}
