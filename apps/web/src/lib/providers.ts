/** Provider directory search (service matching). */

import { and, eq, or, ilike, asc, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { providerSearchQuerySchema } from "@healthpay/shared";
import { type Database } from "@healthpay/db";
import { providers } from "@healthpay/db/schema";

export type ProviderSearchQuery = z.output<typeof providerSearchQuerySchema>;

export async function searchProviders(db: Database, q: ProviderSearchQuery) {
  const filters: SQL[] = [];
  if (q.governorate) filters.push(eq(providers.governorate, q.governorate));
  if (q.providerType) filters.push(eq(providers.providerType, q.providerType));
  if (q.specialty) filters.push(eq(providers.specialty, q.specialty));
  if (q.area) filters.push(ilike(providers.area, `%${q.area}%`));
  if (q.q) {
    const like = `%${q.q}%`;
    const search = or(
      ilike(providers.name, like),
      ilike(providers.area, like),
      ilike(providers.address, like),
    );
    if (search) filters.push(search);
  }
  const where = filters.length ? and(...filters) : undefined;

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providers)
    .where(where);
  const total = countRows[0]?.count ?? 0;

  const items = await db
    .select()
    .from(providers)
    .where(where)
    .orderBy(asc(providers.name))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);

  return { items, total, page: q.page, pageSize: q.pageSize };
}
