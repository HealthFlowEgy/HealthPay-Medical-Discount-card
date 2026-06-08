import {
  runEmbeddedMigrations,
  decodeEmbeddedProviders,
  seedAll,
} from "@healthpay/db";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One-shot database setup, runnable in the deployed environment (where the
 * connection string is injected). Applies the embedded schema migrations and,
 * with `?seed=1`, loads the provider directory + demo data.
 *
 * Protected by CRON_SECRET:  Authorization: Bearer <CRON_SECRET>
 */
function authorize(req: Request) {
  const secret = env.cronSecret;
  if (!secret) throw Object.assign(new Error("CRON_SECRET not configured"), { httpStatus: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return false;
  }
  return true;
}

export async function POST(req: Request) {
  try {
    if (!authorize(req)) {
      return json({ error: { code: "auth_error", message: "Unauthorized" } }, { status: 401 });
    }
    const seed = new URL(req.url).searchParams.get("seed") === "1";
    const db = getDb();

    const migrations = await runEmbeddedMigrations(db);

    let seedResult: Record<string, unknown> | null = null;
    if (seed) {
      const rows = decodeEmbeddedProviders();
      const r = await seedAll(db, rows, { validityHours: env.quoteValidityHours });
      seedResult = {
        providerCount: r.providerCount,
        requestCount: r.requestCount,
        demoPartner: { apiKey: r.apiKey, apiSecret: r.apiSecret, webhookSecret: r.webhookSecret },
        opsLogin: { email: "admin@healthpay.test", password: r.opsPassword },
      };
    }

    return json({ ok: true, migrations, seeded: seed, seedResult });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(req: Request) {
  try {
    if (!authorize(req)) {
      return json({ error: { code: "auth_error", message: "Unauthorized" } }, { status: 401 });
    }
    // Lightweight connectivity + schema check (no secrets returned).
    const db = getDb();
    const { sql } = await import("drizzle-orm");
    const res = await db.execute(
      sql.raw(
        "select to_regclass('public.service_requests') is not null as migrated, " +
          "(select count(*) from information_schema.tables where table_schema='public') as tables",
      ),
    );
    const row = (res as unknown as { rows?: unknown[] }).rows?.[0] ?? (res as unknown[])[0];
    return json({ ok: true, db: row });
  } catch (err) {
    return errorResponse(err);
  }
}
