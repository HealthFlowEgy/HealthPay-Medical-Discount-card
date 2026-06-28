import { eq, sql } from "drizzle-orm";
import { opsUsers } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, non-sensitive bootstrap status: whether a super-admin exists yet and
 * whether the role migration has been applied. Returns booleans only (no PII,
 * no identities). TEMPORARY — used to verify the one-time super-admin bootstrap.
 */
export async function GET() {
  try {
    const [row] = await getDb()
      .select({ c: sql<number>`count(*)::int` })
      .from(opsUsers)
      .where(eq(opsUsers.role, "super_admin"));
    return json({ superAdminExists: (row?.c ?? 0) > 0, migrated: true });
  } catch {
    // The `super_admin` enum value doesn't exist yet → migration not applied.
    return json({ superAdminExists: false, migrated: false });
  }
}
