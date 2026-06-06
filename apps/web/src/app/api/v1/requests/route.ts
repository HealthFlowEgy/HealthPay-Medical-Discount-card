import { createRequestSchema, ValidationError } from "@healthpay/shared";
import { requirePartner } from "@/lib/partner-context";
import { createServiceRequest } from "@/lib/requests";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/requests — partner creates a service request.
export async function POST(req: Request) {
  try {
    const { partner, rawBody } = await requirePartner(req);

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new ValidationError("Request body must be valid JSON.");
    }
    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten());
    }

    const { getDb } = await import("@/lib/db");
    const { request, quoteUrl } = await createServiceRequest(getDb(), partner, parsed.data);

    return json(
      {
        id: request.id,
        status: request.status,
        quote_url: quoteUrl,
        expires_at: request.quoteExpiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
