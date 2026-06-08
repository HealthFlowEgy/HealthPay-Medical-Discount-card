import { clientLoginSchema, ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { verifyClientCredentials, setClientSession } from "@/lib/client-auth";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/portal/login
export async function POST(req: Request) {
  try {
    const parsed = clientLoginSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("National ID and password are required.");
    const db = getDb();
    const client = await verifyClientCredentials(db, parsed.data.nationalId, parsed.data.password);
    await setClientSession(client);
    return json({ ok: true, client: { id: client.id, fullName: client.fullName } });
  } catch (err) {
    return errorResponse(err);
  }
}
