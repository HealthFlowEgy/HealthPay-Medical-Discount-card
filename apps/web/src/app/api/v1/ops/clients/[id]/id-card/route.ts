import { eq } from "drizzle-orm";
import { NotFoundError } from "@healthpay/shared";
import { clients } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { writeAudit } from "@/lib/audit";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/clients/:id/id-card — stream the national-ID card image.
// The Blob URL is never exposed to the browser; ops fetch it through this
// authenticated, audited proxy (admin only).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireOpsUser("admin");
    const db = getDb();
    const [client] = await db
      .select({ idCardUrl: clients.idCardUrl, last4: clients.nationalIdLast4 })
      .from(clients)
      .where(eq(clients.id, params.id))
      .limit(1);
    if (!client) throw new NotFoundError("Client not found.");
    if (!client.idCardUrl) return json({ error: { code: "not_found", message: "No ID card on file." } }, { status: 404 });

    await writeAudit(db, {
      actorType: "ops",
      actorId: admin.userId,
      action: "client.id_card.viewed",
      metadata: { clientId: params.id, by: admin.email },
    });

    const upstream = await fetch(client.idCardUrl);
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
