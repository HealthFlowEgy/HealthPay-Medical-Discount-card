/**
 * One-time bootstrap of the initial super-admin.
 *
 * Runs ONLY from the CRON_SECRET-gated cron handler (Vercel invokes it with the
 * secret), so it is not a public escalation path. It promotes a single
 * designated account, and only while NO super-admin exists yet — so it is
 * self-disabling and can never escalate anyone else.
 *
 * TEMPORARY: remove this once the first super-admin exists in production.
 * After that the database role persists on its own.
 */

import { eq, sql } from "drizzle-orm";
import { runEmbeddedMigrations, type Database } from "@healthpay/db";
import { opsUsers } from "@healthpay/db/schema";

const BOOTSTRAP_SUPER_ADMIN_EMAIL = "admin@healthpay.com.eg";

async function countSuperAdmins(db: Database): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(opsUsers)
    .where(eq(opsUsers.role, "super_admin"));
  return row?.c ?? 0;
}

export async function bootstrapSuperAdminIfNeeded(db: Database): Promise<void> {
  try {
    let existing: number;
    try {
      existing = await countSuperAdmins(db);
    } catch {
      // The `super_admin` enum value isn't in the DB yet → apply pending
      // migrations (idempotent; already-applied statements are ignored), then retry.
      await runEmbeddedMigrations(db);
      existing = await countSuperAdmins(db);
    }
    if (existing > 0) return; // already bootstrapped — inert

    const [user] = await db
      .update(opsUsers)
      .set({ role: "super_admin" })
      .where(eq(opsUsers.email, BOOTSTRAP_SUPER_ADMIN_EMAIL))
      .returning({ id: opsUsers.id, email: opsUsers.email, role: opsUsers.role });

    console.log(
      user
        ? `[bootstrap] promoted ${user.email} to super_admin`
        : `[bootstrap] no ops user '${BOOTSTRAP_SUPER_ADMIN_EMAIL}' found to promote`,
    );
  } catch (err) {
    // Never let bootstrap break the cron's primary job (webhook draining).
    console.error("[bootstrap] super-admin bootstrap failed:", err);
  }
}
