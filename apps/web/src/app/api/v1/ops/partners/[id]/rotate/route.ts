import { NotFoundError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { rotatePartnerKeys } from "@/lib/partners";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/ops/partners/:id/rotate — issue new credentials (returned ONCE).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOpsUser("super_admin");
    const db = getDb();
    const credentials = await rotatePartnerKeys(db, params.id);
    if (!credentials) throw new NotFoundError("Partner not found.");

    await writeAudit(db, {
      actorType: "ops",
      actorId: session.userId,
      action: "partner.keys_rotated",
      metadata: { by: session.email, partnerId: params.id },
    });
    return json({ credentials });
  } catch (err) {
    return errorResponse(err);
  }
}
