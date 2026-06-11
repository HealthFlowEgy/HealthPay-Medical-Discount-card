import { isProviderType, isSpecialty, ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireClient } from "@/lib/client-auth";
import { getCatalogServices } from "@/lib/services";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/portal/services?providerType=&specialty=
// Cascading services for the requested-services dropdown.
export async function GET(req: Request) {
  try {
    await requireClient();
    const url = new URL(req.url);
    const providerType = url.searchParams.get("providerType") ?? "";
    const specialty = url.searchParams.get("specialty") ?? "";
    if (!isProviderType(providerType)) throw new ValidationError("Unknown provider type.");
    const items = await getCatalogServices(
      getDb(),
      providerType,
      isSpecialty(specialty) ? specialty : undefined,
    );
    return json({ items });
  } catch (err) {
    return errorResponse(err);
  }
}
