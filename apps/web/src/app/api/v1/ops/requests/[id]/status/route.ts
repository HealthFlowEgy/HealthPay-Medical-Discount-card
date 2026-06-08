import { z } from "zod";
import { NotFoundError, ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { getRequestById } from "@/lib/requests";
import { transitionRequest } from "@/lib/transitions";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ops can mark a request Completed (منتهي) or Cancelled (ملغي).
const bodySchema = z.object({ status: z.enum(["completed", "cancelled"]) });

// POST /api/v1/ops/requests/:id/status
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOpsUser();
    const db = getDb();
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("status must be 'completed' or 'cancelled'.");

    const request = await getRequestById(db, params.id);
    if (!request) throw new NotFoundError("Request not found.");

    const updated = await transitionRequest(db, request, parsed.data.status, {
      actorType: "ops",
      actorId: session.userId,
      metadata: { by: session.email, byName: session.name },
    });
    return json({ id: updated.id, status: updated.status });
  } catch (err) {
    return errorResponse(err);
  }
}
