import { confirmSchema, NotFoundError, ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireClient } from "@/lib/client-auth";
import {
  getRequestById,
  confirmRequest,
  getOptions,
  getConfirmation,
} from "@/lib/requests";
import { serializeRequestForClient } from "@/lib/serializers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/portal/requests/:id/confirm — client confirms a chosen option.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireClient();
    const db = getDb();
    const parsed = confirmSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("Please select an option.");

    const request = await getRequestById(db, params.id);
    if (!request || request.clientId !== session.clientId) {
      throw new NotFoundError("Request not found.");
    }
    const updated = await confirmRequest(db, request, parsed.data.optionId, "hosted_page", {
      actorType: "user",
      actorId: session.clientId,
    });
    const options = await getOptions(db, updated.id);
    const confirmation = await getConfirmation(db, updated.id);
    return json(serializeRequestForClient(updated, options, confirmation?.selectedOptionId));
  } catch (err) {
    return errorResponse(err);
  }
}
