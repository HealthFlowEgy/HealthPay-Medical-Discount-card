import { desc, eq, inArray } from "drizzle-orm";
import { auditLog, opsUsers } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/requests/:id/audit — the request's audit trail (status changes,
// PII reveals, etc.) with the acting employee resolved.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireOpsUser();
    const db = getDb();
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.requestId, params.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(100);

    // Resolve ops actor names.
    const opsIds = [
      ...new Set(rows.filter((r) => r.actorType === "ops" && r.actorId).map((r) => r.actorId!)),
    ];
    const names = new Map<string, string>();
    if (opsIds.length) {
      const users = await db
        .select({ id: opsUsers.id, name: opsUsers.name, email: opsUsers.email })
        .from(opsUsers)
        .where(inArray(opsUsers.id, opsIds));
      for (const u of users) names.set(u.id, u.name);
    }

    const meta = (m: unknown) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {});
    return json({
      entries: rows.map((r) => {
        const m = meta(r.metadata);
        return {
          action: r.action,
          actorType: r.actorType,
          actor:
            (m.byName as string) ??
            (r.actorId ? names.get(r.actorId) : null) ??
            r.actorType,
          from: (m.from as string) ?? null,
          to: (m.to as string) ?? null,
          at: r.createdAt.toISOString(),
        };
      }),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
