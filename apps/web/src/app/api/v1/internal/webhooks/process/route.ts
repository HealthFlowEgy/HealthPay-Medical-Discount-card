import { getDb } from "@/lib/db";
import { processDueWebhooks } from "@/lib/webhooks";
import { bootstrapSuperAdminIfNeeded } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drains webhook deliveries whose backoff retry is due. Intended to be invoked
 * by a scheduler (Vercel Cron) — the serverless-friendly substitute for a
 * long-lived background worker. Protected by CRON_SECRET when configured.
 *
 * Vercel Cron sends GET; we also accept POST for manual triggering.
 */
async function run(req: Request): Promise<Response> {
  if (env.cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.cronSecret}`) {
      return json({ error: { code: "auth_error", message: "Unauthorized" } }, { status: 401 });
    }
  }
  // One-time, self-disabling bootstrap of the initial super-admin (gated by the
  // CRON_SECRET check above). Best-effort — never blocks webhook draining.
  await bootstrapSuperAdminIfNeeded(getDb());

  const processed = await processDueWebhooks(getDb());
  return json({ processed });
}

export async function GET(req: Request) {
  try {
    return await run(req);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    return await run(req);
  } catch (err) {
    return errorResponse(err);
  }
}
