/** Provider directory search (service matching). */

import { and, eq, or, ilike, asc, sql, isNotNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { providerSearchQuerySchema, ValidationError } from "@healthpay/shared";
import { type Database } from "@healthpay/db";
import { providers } from "@healthpay/db/schema";

export type ProviderSearchQuery = z.output<typeof providerSearchQuerySchema>;

/** Parse + validate provider-search params from a request URL. */
export function parseProviderQuery(req: Request): ProviderSearchQuery {
  const url = new URL(req.url);
  const parsed = providerSearchQuerySchema.safeParse({
    governorate: url.searchParams.get("governorate") ?? undefined,
    area: url.searchParams.get("area") ?? undefined,
    providerType:
      url.searchParams.get("providerType") ?? url.searchParams.get("provider_type") ?? undefined,
    specialty: url.searchParams.get("specialty") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
  return parsed.data;
}

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

  // The source directory repeats a provider once per specialty/service it
  // offers, so the same clinic appears many times per area. Collapse to one
  // row per (governorate, area, name) for clean dropdowns and accurate counts.
  const lowerName = sql`lower(${providers.name})`;
  const dedupKey = sql<string>`lower(${providers.name}) || '|' || coalesce(${providers.area}, '') || '|' || coalesce(${providers.governorate}::text, '')`;

  const countRows = await db
    .select({ count: sql<number>`count(distinct ${dedupKey})::int` })
    .from(providers)
    .where(where);
  const total = countRows[0]?.count ?? 0;

  const items = await db
    .selectDistinctOn([lowerName, providers.area, providers.governorate])
    .from(providers)
    .where(where)
    .orderBy(lowerName, asc(providers.area), asc(providers.governorate))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);

  return { items, total, page: q.page, pageSize: q.pageSize };
}

/** Distinct areas within a governorate (for the cascading address dropdown). */
export async function listAreas(db: Database, governorate: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ area: providers.area })
    .from(providers)
    .where(and(eq(providers.governorate, governorate as never), isNotNull(providers.area)))
    .orderBy(asc(providers.area));
  return rows.map((r) => r.area).filter((a): a is string => !!a);
}
