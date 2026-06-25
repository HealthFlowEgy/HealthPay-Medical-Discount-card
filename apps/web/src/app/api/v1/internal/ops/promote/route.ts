import { z } from "zod";
import { eq } from "drizzle-orm";
import { opsUsers } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bootstrap utility to set an ops user's role — used to mint the FIRST
 * super-admin in production (where there is no UI to grant super_admin).
 *
 *   POST  Authorization: Bearer <CRON_SECRET>
 *   Body: { "email": "you@healthflow.tech", "role": "super_admin" }
 */
const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["agent", "admin", "super_admin"]),
});

export async function POST(req: Request) {
  try {
    if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
      return json({ error: { code: "auth_error", message: "Unauthorized" } }, { status: 401 });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: { code: "validation_error", message: "email and role required" } }, { status: 422 });
    }

    const [updated] = await getDb()
      .update(opsUsers)
      .set({ role: parsed.data.role })
      .where(eq(opsUsers.email, parsed.data.email.toLowerCase().trim()))
      .returning({ id: opsUsers.id, email: opsUsers.email, role: opsUsers.role });
    if (!updated) {
      return json({ error: { code: "not_found", message: "Ops user not found" } }, { status: 404 });
    }
    return json({ ok: true, user: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
