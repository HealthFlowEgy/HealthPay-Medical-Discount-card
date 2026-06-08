/** Ops queue listing: filtered, paginated request queue + detail with PII. */

import { and, or, eq, ilike, desc, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { opsQueueQuerySchema } from "@healthpay/shared";
import { type Database } from "@healthpay/db";
import { partners, serviceRequests, providers, clients } from "@healthpay/db/schema";

export type OpsQueueQuery = z.output<typeof opsQueueQuerySchema>;

/** Build the shared WHERE clause for the queue + export. */
function queueWhere(q: OpsQueueQuery) {
  const filters: SQL[] = [];
  if (q.status) filters.push(eq(serviceRequests.status, q.status));
  if (q.governorate) filters.push(eq(serviceRequests.governorate, q.governorate));
  if (q.serviceType) filters.push(eq(serviceRequests.serviceType, q.serviceType));
  if (q.providerType) filters.push(eq(serviceRequests.providerType, q.providerType));
  if (q.specialty) filters.push(eq(serviceRequests.specialty, q.specialty));
  if (q.q) {
    const like = `%${q.q}%`;
    const search = or(
      ilike(serviceRequests.mobileE164, like),
      ilike(serviceRequests.partnerReference, like),
      ilike(serviceRequests.memberNameAr, like),
      ilike(serviceRequests.memberNameEn, like),
      ilike(partners.name, like),
    );
    if (search) filters.push(search);
  }
  return filters.length ? and(...filters) : undefined;
}

const exportColumns = {
  id: serviceRequests.id,
  status: serviceRequests.status,
  serviceType: serviceRequests.serviceType,
  providerType: serviceRequests.providerType,
  specialty: serviceRequests.specialty,
  governorate: serviceRequests.governorate,
  area: serviceRequests.area,
  city: serviceRequests.city,
  mobileE164: serviceRequests.mobileE164,
  nationalIdLast4: serviceRequests.nationalIdLast4,
  nationalIdEncrypted: serviceRequests.nationalIdEncrypted,
  clientId: serviceRequests.clientId,
  idCardUrl: clients.idCardUrl,
  memberNameAr: serviceRequests.memberNameAr,
  memberNameEn: serviceRequests.memberNameEn,
  requestedServices: serviceRequests.requestedServices,
  providerName: providers.name,
  partnerReference: serviceRequests.partnerReference,
  partnerName: partners.name,
  quoteExpiresAt: serviceRequests.quoteExpiresAt,
  createdAt: serviceRequests.createdAt,
  updatedAt: serviceRequests.updatedAt,
} as const;

/** All filtered rows (no pagination) for Excel export. */
export async function exportRequests(db: Database, q: OpsQueueQuery) {
  return db
    .select(exportColumns)
    .from(serviceRequests)
    .leftJoin(partners, eq(serviceRequests.partnerId, partners.id))
    .leftJoin(providers, eq(serviceRequests.providerId, providers.id))
    .leftJoin(clients, eq(serviceRequests.clientId, clients.id))
    .where(queueWhere(q))
    .orderBy(desc(serviceRequests.createdAt))
    .limit(5000);
}

export async function listRequests(db: Database, q: OpsQueueQuery) {
  const where = queueWhere(q);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceRequests)
    .leftJoin(partners, eq(serviceRequests.partnerId, partners.id))
    .where(where);
  const count = countRows[0]?.count ?? 0;

  const rows = await db
    .select(exportColumns)
    .from(serviceRequests)
    .leftJoin(partners, eq(serviceRequests.partnerId, partners.id))
    .leftJoin(providers, eq(serviceRequests.providerId, providers.id))
    .leftJoin(clients, eq(serviceRequests.clientId, clients.id))
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
