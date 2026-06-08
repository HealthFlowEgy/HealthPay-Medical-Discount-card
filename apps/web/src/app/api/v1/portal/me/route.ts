import { getClientSession } from "@/lib/client-auth";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getClientSession();
    if (!session) return json({ authenticated: false }, { status: 401 });
    return json({ authenticated: true, client: session });
  } catch (err) {
    return errorResponse(err);
  }
}
