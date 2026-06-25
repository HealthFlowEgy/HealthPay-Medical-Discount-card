import { eq, sql } from "drizzle-orm";
import { ConflictError } from "@healthpay/shared";
import { runEmbeddedMigrations } from "@healthpay/db";
import { opsUsers } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One-time bootstrap (no secret required): an authenticated admin may claim the
 * super-admin role IF none exists yet. Also applies any pending schema
 * migrations first, so the `super_admin` role value exists. Becomes inert the
 * moment a super-admin exists (first-claim-wins), so it is safe to leave in.
 */
export async function POST() {
  try {
    const session = await requireOpsUser("admin");
    const db = getDb();

    // Ensure the schema is current (adds the super_admin enum value + columns).
    await runEmbeddedMigrations(db);

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opsUsers)
      .where(eq(opsUsers.role, "super_admin"));
    if ((row?.count ?? 0) > 0) {
      throw new ConflictError("A super-admin already exists.");
    }

    const [updated] = await db
      .update(opsUsers)
      .set({ role: "super_admin" })
      .where(eq(opsUsers.id, session.userId))
      .returning({ id: opsUsers.id, email: opsUsers.email, role: opsUsers.role });

    await writeAudit(db, {
      actorType: "ops",
      actorId: session.userId,
      action: "ops.super_admin_bootstrapped",
      metadata: { email: session.email },
    });
    return json({ ok: true, user: updated, reloginRequired: true });
  } catch (err) {
    return errorResponse(err);
  }
}
