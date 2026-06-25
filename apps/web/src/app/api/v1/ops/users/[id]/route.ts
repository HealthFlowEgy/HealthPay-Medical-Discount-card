import { eq } from "drizzle-orm";
import { opsUserUpdateSchema, ValidationError, NotFoundError, ConflictError, AuthError } from "@healthpay/shared";
import { opsUsers } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { requireOpsUser, roleAtLeast } from "@/lib/ops-auth";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/v1/ops/users/:id — change role / activate-deactivate (admin only).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireOpsUser("admin");
    const parsed = opsUserUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    // An admin cannot deactivate or demote themselves (avoid lock-out).
    if (params.id === admin.userId && (parsed.data.active === false || parsed.data.role === "agent")) {
      throw new ConflictError("You cannot deactivate or demote your own account.");
    }

    const db = getDb();

    // Only a super-admin may modify a super-admin account (no admin can demote
    // or deactivate one).
    const [target] = await db
      .select({ role: opsUsers.role })
      .from(opsUsers)
      .where(eq(opsUsers.id, params.id))
      .limit(1);
    if (!target) throw new NotFoundError("User not found.");
    if (target.role === "super_admin" && !roleAtLeast(admin.role, "super_admin")) {
      throw new AuthError("Only a super-admin can modify a super-admin account.");
    }

    const set: Record<string, unknown> = {};
    if (parsed.data.role !== undefined) set.role = parsed.data.role;
    if (parsed.data.active !== undefined) set.active = parsed.data.active;
    if (Object.keys(set).length === 0) throw new ValidationError("Nothing to update.");

    const [updated] = await db
      .update(opsUsers)
      .set(set)
      .where(eq(opsUsers.id, params.id))
      .returning({ id: opsUsers.id, email: opsUsers.email, role: opsUsers.role, active: opsUsers.active });
    if (!updated) throw new NotFoundError("User not found.");

    await writeAudit(db, {
      actorType: "ops",
      actorId: admin.userId,
      action: "ops.user.updated",
      metadata: { target: updated.email, ...set, by: admin.email },
    });
    return json({ ok: true, user: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
