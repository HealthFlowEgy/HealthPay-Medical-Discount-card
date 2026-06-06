import { NotFoundError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import {
  getRequestByToken,
  getOptions,
  getConfirmation,
  expireRequestIfDue,
} from "@/lib/requests";
import { serializeRequestForQuotePage } from "@/lib/serializers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/quote/:token — hosted-page view. Token is the bearer credential.
// Never exposes the national ID; mobile is masked.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const db = getDb();
    let request = await getRequestByToken(db, params.token);
    if (!request) throw new NotFoundError("This quote link is invalid.");
    request = await expireRequestIfDue(db, request);

    const options = await getOptions(db, request.id);
    const confirmation = await getConfirmation(db, request.id);
    return json(
      serializeRequestForQuotePage(request, options, confirmation?.selectedOptionId),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
