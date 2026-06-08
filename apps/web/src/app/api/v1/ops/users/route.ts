import { desc } from "drizzle-orm";
import { opsUserCreateSchema, ValidationError } from "@healthpay/shared";
import { opsUsers } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { requireOpsUser, createOpsUser } from "@/lib/ops-auth";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/users — list staff (admin only).
export async function GET() {
  try {
    await requireOpsUser("admin");
    const rows = await getDb()
      .select({
        id: opsUsers.id,
        email: opsUsers.email,
        name: opsUsers.name,
        role: opsUsers.role,
        active: opsUsers.active,
        createdAt: opsUsers.createdAt,
      })
      .from(opsUsers)
      .orderBy(desc(opsUsers.createdAt));
    return json({ items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/v1/ops/users — create a staff account (admin only).
export async function POST(req: Request) {
  try {
    const admin = await requireOpsUser("admin");
    const parsed = opsUserCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const db = getDb();
    const created = await createOpsUser(db, parsed.data);
    await writeAudit(db, {
      actorType: "ops",
      actorId: admin.userId,
      action: "ops.user.created",
      metadata: { email: created.email, role: created.role, by: admin.email },
    });
    return json({ ok: true, user: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
