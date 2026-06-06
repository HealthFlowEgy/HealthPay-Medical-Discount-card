import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { removeOption } from "@/lib/requests";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/v1/ops/options/:id — remove an option while QUOTED & unconfirmed.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOpsUser();
    await removeOption(getDb(), params.id, session.userId);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
