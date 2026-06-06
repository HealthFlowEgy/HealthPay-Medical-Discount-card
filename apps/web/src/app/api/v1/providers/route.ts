import { providerSearchQuerySchema, ValidationError } from "@healthpay/shared";
import { requirePartner } from "@/lib/partner-context";
import { getDb } from "@/lib/db";
import { searchProviders } from "@/lib/providers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/providers — search the provider directory (partner auth).
export async function GET(req: Request) {
  try {
    await requirePartner(req);
    const result = await searchProviders(getDb(), parseQuery(req));
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export function parseQuery(req: Request) {
  const url = new URL(req.url);
  const parsed = providerSearchQuerySchema.safeParse({
    governorate: url.searchParams.get("governorate") ?? undefined,
    area: url.searchParams.get("area") ?? undefined,
    providerType:
      url.searchParams.get("providerType") ?? url.searchParams.get("provider_type") ?? undefined,
    specialty: url.searchParams.get("specialty") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
  return parsed.data;
}
