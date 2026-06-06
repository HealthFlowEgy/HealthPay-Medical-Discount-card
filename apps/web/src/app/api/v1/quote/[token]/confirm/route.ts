import { confirmSchema, NotFoundError, ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import {
  getRequestByToken,
  confirmRequest,
  getOptions,
  getConfirmation,
} from "@/lib/requests";
import { serializeRequestForQuotePage } from "@/lib/serializers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/quote/:token/confirm — end user selects exactly one option.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const db = getDb();
    const parsed = confirmSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError("Please select a pricing option.", parsed.error.flatten());
    }

    const request = await getRequestByToken(db, params.token);
    if (!request) throw new NotFoundError("This quote link is invalid.");

    const updated = await confirmRequest(db, request, parsed.data.optionId, "hosted_page", {
      actorType: "user",
      actorId: request.id,
    });

    const options = await getOptions(db, updated.id);
    const confirmation = await getConfirmation(db, updated.id);
    return json(
      serializeRequestForQuotePage(updated, options, confirmation?.selectedOptionId),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
