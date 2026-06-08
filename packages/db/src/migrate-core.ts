/**
 * Run the embedded migration statements against the database. Used by the
 * one-shot `/api/v1/internal/db/setup` route so the schema can be applied at
 * runtime (where the connection string is injected) with no filesystem access.
 */

import { gunzipSync } from "node:zlib";
import { sql } from "drizzle-orm";
import type { Database } from "./client.js";
import { MIGRATION_STATEMENTS, PROVIDERS_GZ_B64 } from "./embedded.js";
import type { ProviderSeedRow } from "./seed-core.js";

// Postgres error codes that are safe to ignore on re-run (object already exists).
const IGNORABLE = new Set(["42P07", "42710", "42P06", "42701", "42P16", "42723"]);

export async function runEmbeddedMigrations(
  db: Database,
): Promise<{ executed: number; skipped: number }> {
  let executed = 0;
  let skipped = 0;
  for (const stmt of MIGRATION_STATEMENTS) {
    try {
      await db.execute(sql.raw(stmt));
      executed++;
    } catch (err) {
      const code = (err as { code?: string; cause?: { code?: string } })?.code ??
        (err as { cause?: { code?: string } })?.cause?.code;
      if (code && IGNORABLE.has(code)) {
        skipped++;
        continue;
      }
      throw err;
    }
  }
  return { executed, skipped };
}

/** Decode the embedded gzipped provider directory. */
export function decodeEmbeddedProviders(): ProviderSeedRow[] {
  return JSON.parse(gunzipSync(Buffer.from(PROVIDERS_GZ_B64, "base64")).toString("utf8"));
}
