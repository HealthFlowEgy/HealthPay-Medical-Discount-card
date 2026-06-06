import { confirmSchema, NotFoundError, ValidationError } from "@healthpay/shared";
import { requirePartner } from "@/lib/partner-context";
import { getDb } from "@/lib/db";
import {
  getRequestById,
  confirmRequest,
  getOptions,
  getConfirmation,
} from "@/lib/requests";
import { serializeRequestForPartner } from "@/lib/serializers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/requests/:id/confirm — confirm a selected option via the SDK.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { partner, rawBody } = await requirePartner(req);
    const db = getDb();

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new ValidationError("Request body must be valid JSON.");
    }
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten());
    }

    const request = await getRequestById(db, params.id);
    if (!request || request.partnerId !== partner.id) {
      throw new NotFoundError("Request not found.");
    }

    const updated = await confirmRequest(db, request, parsed.data.optionId, "sdk", {
      actorType: "partner",
      actorId: partner.id,
    });

    const options = await getOptions(db, updated.id);
    const confirmation = await getConfirmation(db, updated.id);
    return json(
      serializeRequestForPartner(updated, options, confirmation?.selectedOptionId),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
