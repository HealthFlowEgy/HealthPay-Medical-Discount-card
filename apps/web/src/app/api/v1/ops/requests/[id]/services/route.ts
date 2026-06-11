import { z } from "zod";
import { eq } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@healthpay/shared";
import { serviceRequests } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { getRequestById } from "@/lib/requests";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  services: z.array(z.string().trim().min(1).max(200)).max(50),
});

// POST /api/v1/ops/requests/:id/services
// Ops curates the client's requested services (e.g. dropping ones the provider
// can't offer, or adding a substitute). Stored back on the request, audited.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOpsUser();
    const db = getDb();

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError("Invalid services list.", parsed.error.flatten());
    }

    const request = await getRequestById(db, params.id);
    if (!request) throw new NotFoundError("Request not found.");

    // De-duplicate, preserve order, and join with the canonical separator.
    const services = [...new Set(parsed.data.services)];
    const joined = services.length ? services.join("، ") : null;

    const [updated] = await db
      .update(serviceRequests)
      .set({ requestedServices: joined, updatedAt: new Date() })
      .where(eq(serviceRequests.id, request.id))
      .returning();

    await writeAudit(db, {
      actorType: "ops",
      actorId: session.userId,
      action: "request.services_edited",
      requestId: request.id,
      metadata: { by: session.email, count: services.length },
    });

    return json({ id: request.id, requestedServices: updated?.requestedServices ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}
