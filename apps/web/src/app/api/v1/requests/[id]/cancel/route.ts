import { NotFoundError } from "@healthpay/shared";
import { requirePartner } from "@/lib/partner-context";
import { getDb } from "@/lib/db";
import { getRequestById, cancelRequest } from "@/lib/requests";
import { serializeRequestForPartner } from "@/lib/serializers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/requests/:id/cancel — partner cancels a request.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { partner } = await requirePartner(req);
    const db = getDb();

    const request = await getRequestById(db, params.id);
    if (!request || request.partnerId !== partner.id) {
      throw new NotFoundError("Request not found.");
    }

    const updated = await cancelRequest(db, request, {
      actorType: "partner",
      actorId: partner.id,
    });
    return json(serializeRequestForPartner(updated));
  } catch (err) {
    return errorResponse(err);
  }
}
