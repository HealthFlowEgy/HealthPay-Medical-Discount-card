import { eq } from "drizzle-orm";
import { clientUpdateSchema, NotFoundError, ValidationError } from "@healthpay/shared";
import { clients } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/v1/ops/clients/:id — suspend / reactivate a client (admin only).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireOpsUser("admin");
    const parsed = clientUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("active (boolean) required.");

    const db = getDb();
    const [updated] = await db
      .update(clients)
      .set({ active: parsed.data.active })
      .where(eq(clients.id, params.id))
      .returning({ id: clients.id, active: clients.active, nationalIdLast4: clients.nationalIdLast4 });
    if (!updated) throw new NotFoundError("Client not found.");

    await writeAudit(db, {
      actorType: "ops",
      actorId: admin.userId,
      action: parsed.data.active ? "client.reactivated" : "client.suspended",
      metadata: { clientId: updated.id, by: admin.email },
    });
    return json({ ok: true, client: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
