import { z } from "zod";
import { ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { listPartners, createPartner } from "@/lib/partners";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/partners — list partners (super-admin only). No secrets.
export async function GET() {
  try {
    await requireOpsUser("super_admin");
    const rows = await listPartners(getDb());
    return json({ items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch (err) {
    return errorResponse(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  webhookUrl: z.string().trim().url().max(500).optional(),
});

// POST /api/v1/ops/partners — create a partner; returns credentials ONCE.
export async function POST(req: Request) {
  try {
    const session = await requireOpsUser("super_admin");
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const db = getDb();
    const partner = await createPartner(db, {
      name: parsed.data.name,
      webhookUrl: parsed.data.webhookUrl,
    });
    await writeAudit(db, {
      actorType: "ops",
      actorId: session.userId,
      action: "partner.created",
      metadata: { by: session.email, partnerId: partner.id, name: partner.name },
    });
    return json({ partner }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
