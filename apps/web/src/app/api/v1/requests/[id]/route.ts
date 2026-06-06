import { NotFoundError } from "@healthpay/shared";
import { requirePartner } from "@/lib/partner-context";
import { getDb } from "@/lib/db";
import {
  getRequestById,
  getOptions,
  getConfirmation,
  expireRequestIfDue,
} from "@/lib/requests";
import { serializeRequestForPartner } from "@/lib/serializers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/requests/:id — status + options (if quoted/confirmed) + selection.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { partner } = await requirePartner(req);
    const db = getDb();

    let request = await getRequestById(db, params.id);
    if (!request || request.partnerId !== partner.id) {
      throw new NotFoundError("Request not found.");
    }
    request = await expireRequestIfDue(db, request);

    const showOptions = request.status === "quoted" || request.status === "confirmed";
    const options = showOptions ? await getOptions(db, request.id) : undefined;
    const confirmation =
      request.status === "confirmed" ? await getConfirmation(db, request.id) : undefined;

    return json(
      serializeRequestForPartner(request, options, confirmation?.selectedOptionId),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
