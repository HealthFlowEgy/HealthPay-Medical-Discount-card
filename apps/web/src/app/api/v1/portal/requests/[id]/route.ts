import { NotFoundError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireClient } from "@/lib/client-auth";
import { getRequestById, getOptions, getConfirmation, expireRequestIfDue } from "@/lib/requests";
import { serializeRequestForClient } from "@/lib/serializers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/portal/requests/:id — one of the client's requests.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const db = getDb();
    let request = await getRequestById(db, params.id);
    if (!request || request.clientId !== session.clientId) {
      throw new NotFoundError("Request not found.");
    }
    request = await expireRequestIfDue(db, request);
    const options = await getOptions(db, request.id);
    const confirmation = await getConfirmation(db, request.id);
    return json(serializeRequestForClient(request, options, confirmation?.selectedOptionId));
  } catch (err) {
    return errorResponse(err);
  }
}
