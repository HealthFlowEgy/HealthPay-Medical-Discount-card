/** Ops queue listing: filtered, paginated request queue + detail with PII. */

import { and, or, eq, ilike, desc, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { opsQueueQuerySchema } from "@healthpay/shared";
import { type Database } from "@healthpay/db";
import { partners, serviceRequests } from "@healthpay/db/schema";

export type OpsQueueQuery = z.output<typeof opsQueueQuerySchema>;

export async function listRequests(db: Database, q: OpsQueueQuery) {
  const filters: SQL[] = [];
  if (q.status) filters.push(eq(serviceRequests.status, q.status));
  if (q.governorate) filters.push(eq(serviceRequests.governorate, q.governorate));
  if (q.serviceType) filters.push(eq(serviceRequests.serviceType, q.serviceType));
  if (q.q) {
    const like = `%${q.q}%`;
    const search = or(
      ilike(serviceRequests.mobileE164, like),
      ilike(serviceRequests.partnerReference, like),
      ilike(partners.name, like),
    );
    if (search) filters.push(search);
  }
  const where = filters.length ? and(...filters) : undefined;

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceRequests)
    .leftJoin(partners, eq(serviceRequests.partnerId, partners.id))
    .where(where);
  const count = countRows[0]?.count ?? 0;

  const rows = await db
    .select({
      id: serviceRequests.id,
      status: serviceRequests.status,
      serviceType: serviceRequests.serviceType,
      governorate: serviceRequests.governorate,
      city: serviceRequests.city,
      mobileE164: serviceRequests.mobileE164,
      nationalIdLast4: serviceRequests.nationalIdLast4,
      partnerReference: serviceRequests.partnerReference,
      partnerName: partners.name,
      quoteExpiresAt: serviceRequests.quoteExpiresAt,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
    })
    .from(serviceRequests)
    .leftJoin(partners, eq(serviceRequests.partnerId, partners.id))
    .where(where)
    .orderBy(desc(serviceRequests.createdAt))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);

  return {
    items: rows,
    total: count,
    page: q.page,
    pageSize: q.pageSize,
  };
}
