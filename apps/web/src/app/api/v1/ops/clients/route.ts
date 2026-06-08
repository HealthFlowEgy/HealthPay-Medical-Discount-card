import { and, or, ilike, desc, sql, type SQL } from "drizzle-orm";
import { maskMobile } from "@healthpay/shared";
import { clients } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/clients?q= — list/search portal clients (admin only).
export async function GET(req: Request) {
  try {
    await requireOpsUser("admin");
    const q = new URL(req.url).searchParams.get("q")?.trim();
    const where: SQL | undefined = q
      ? (or(
          ilike(clients.fullName, `%${q}%`),
          ilike(clients.mobileE164, `%${q}%`),
          ilike(clients.nationalIdLast4, `%${q}%`),
        ) as SQL)
      : undefined;

    const rows = await getDb()
      .select({
        id: clients.id,
        fullName: clients.fullName,
        nationalIdLast4: clients.nationalIdLast4,
        mobileE164: clients.mobileE164,
        whatsapp: clients.whatsapp,
        active: clients.active,
        hasIdCard: sql<boolean>`${clients.idCardUrl} is not null`,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(where ? and(where) : undefined)
      .orderBy(desc(clients.createdAt))
      .limit(200);

    return json({
      items: rows.map((r) => ({
        ...r,
        mobile: maskMobile(r.mobileE164),
        mobileE164: undefined,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
