import { z } from "zod";
import { ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { verifyCredentials, setSessionCookie } from "@/lib/ops-auth";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/v1/ops/login
export async function POST(req: Request) {
  try {
    const parsed = loginSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("Email and password are required.");

    const db = getDb();
    const session = await verifyCredentials(db, parsed.data.email, parsed.data.password);
    await setSessionCookie(session);
    await writeAudit(db, {
      actorType: "ops",
      actorId: session.userId,
      action: "ops.login",
      metadata: { email: session.email },
    });
    return json({ user: { email: session.email, name: session.name, role: session.role } });
  } catch (err) {
    return errorResponse(err);
  }
}
