/**
 * Applies any pending embedded migrations to the shared database, once per warm
 * lambda instance. Runs only from the CRON_SECRET-gated cron handler, so it is
 * not a public surface. The embedded runner is idempotent (already-applied
 * statements are ignored), so this is safe to call repeatedly; the in-memory
 * guard keeps it to ~once per cold start rather than every invocation.
 *
 * This is how schema changes reach production without a manual secret step.
 */

import { runEmbeddedMigrations, type Database } from "@healthpay/db";

let migratedThisInstance = false;

export async function ensureSchemaMigrated(db: Database): Promise<void> {
  if (migratedThisInstance) return;
  try {
    const result = await runEmbeddedMigrations(db);
    migratedThisInstance = true;
    if (result.executed > 0) {
      console.log(`[migrate] applied ${result.executed} statement(s)`);
    }
  } catch (err) {
    // Never block the cron's primary job; retry on the next invocation.
    console.error("[migrate] embedded migration run failed:", err);
  }
}
