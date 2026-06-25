import { z } from "zod";
import { NotFoundError, ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { updatePartner } from "@/lib/partners";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    status: z.enum(["active", "suspended"]).optional(),
    webhookUrl: z.string().trim().url().max(500).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.webhookUrl !== undefined, {
    message: "Nothing to update.",
  });

// PATCH /api/v1/ops/partners/:id — suspend/activate or update webhook URL.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOpsUser("super_admin");
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const db = getDb();
    const updated = await updatePartner(db, params.id, parsed.data);
    if (!updated) throw new NotFoundError("Partner not found.");

    await writeAudit(db, {
      actorType: "ops",
      actorId: session.userId,
      action: "partner.updated",
      metadata: { by: session.email, partnerId: params.id, changes: parsed.data },
    });
    return json({ partner: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
