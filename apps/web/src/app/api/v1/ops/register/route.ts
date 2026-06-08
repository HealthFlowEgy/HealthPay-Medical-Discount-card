import { opsRegisterSchema, ValidationError, AuthError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { createOpsUser, setSessionCookie } from "@/lib/ops-auth";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/ops/register — open staff self-signup. New accounts are ALWAYS
// created as `agent`; only an admin can promote to `admin`. Optionally gated by
// OPS_SIGNUP_CODE.
export async function POST(req: Request) {
  try {
    const parsed = opsRegisterSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    if (env.opsSignupCode && parsed.data.signupCode !== env.opsSignupCode) {
      throw new AuthError("Invalid sign-up code.");
    }

    const db = getDb();
    const session = await createOpsUser(db, {
      email: parsed.data.email,
      name: parsed.data.name,
      password: parsed.data.password,
      role: "agent",
    });
    await setSessionCookie(session);
    await writeAudit(db, {
      actorType: "ops",
      actorId: session.userId,
      action: "ops.self_signup",
      metadata: { email: session.email },
    });
    return json({ ok: true, user: { email: session.email, name: session.name, role: session.role } }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
