import { eq } from "drizzle-orm";
import { NotFoundError } from "@healthpay/shared";
import { serviceRequests, clients } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/requests/:id/id-card — stream the requesting client's national
// ID card (any ops; audited). The Blob URL is never exposed to the browser.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOpsUser();
    const db = getDb();
    const [row] = await db
      .select({ clientId: serviceRequests.clientId, idCardUrl: clients.idCardUrl })
      .from(serviceRequests)
      .leftJoin(clients, eq(serviceRequests.clientId, clients.id))
      .where(eq(serviceRequests.id, params.id))
      .limit(1);
    if (!row) throw new NotFoundError("Request not found.");
    if (!row.idCardUrl) {
      return json({ error: { code: "not_found", message: "No ID card on file." } }, { status: 404 });
    }

    await writeAudit(db, {
      actorType: "ops",
      actorId: session.userId,
      action: "client.id_card.viewed",
      requestId: params.id,
      metadata: { clientId: row.clientId, by: session.email },
    });

    const upstream = await fetch(row.idCardUrl);
    if (!upstream.ok || !upstream.body) {
      return json({ error: { code: "internal_error", message: "Failed to load image." } }, { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
