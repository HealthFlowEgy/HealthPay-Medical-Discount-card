import { attachOptionsSchema, NotFoundError, ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { getRequestById, attachOptions, getOptions } from "@/lib/requests";
import { serializeOption } from "@/lib/serializers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/ops/requests/:id/options — attach one or more pricing options.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOpsUser();
    const db = getDb();

    const parsed = attachOptionsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten());
    }

    const request = await getRequestById(db, params.id);
    if (!request) throw new NotFoundError("Request not found.");

    const updated = await attachOptions(db, request, parsed.data.options, session.userId);
    const options = await getOptions(db, updated.id);
    return json(
      { id: updated.id, status: updated.status, options: options.map(serializeOption) },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
