import { portalRequestSchema, ValidationError, NotFoundError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireClient, getClientById } from "@/lib/client-auth";
import { createClientRequest, getClientRequests, getOptions } from "@/lib/requests";
import { serializeRequestForClient } from "@/lib/serializers";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/portal/requests — the client's own requests (My Requests).
export async function GET() {
  try {
    const session = await requireClient();
    const db = getDb();
    const rows = await getClientRequests(db, session.clientId);
    const items = await Promise.all(
      rows.map(async (r) => {
        const options =
          r.status === "quoted" || r.status === "confirmed" || r.status === "completed"
            ? await getOptions(db, r.id)
            : [];
        return serializeRequestForClient(r, options);
      }),
    );
    return json({ items });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/v1/portal/requests — create a new request (multiple allowed).
export async function POST(req: Request) {
  try {
    const session = await requireClient();
    const db = getDb();
    const parsed = portalRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const client = await getClientById(db, session.clientId);
    if (!client) throw new NotFoundError("Client account not found.");

    const { request, quoteUrl } = await createClientRequest(db, client, parsed.data);
    return json(
      { id: request.id, status: request.status, quoteUrl, expiresAt: request.quoteExpiresAt.toISOString() },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
