/** Predefined services for a provider: per-provider data if imported, else the
 *  fallback catalog keyed by the provider's type. */

import { and, asc, eq, isNull, or } from "drizzle-orm";
import type { ProviderType, Specialty } from "@healthpay/shared";
import type { Database } from "@healthpay/db";
import { providers, providerServices, serviceCatalog } from "@healthpay/db/schema";

/**
 * Cascading services list for the requested-services dropdown: services for the
 * chosen provider type, narrowed to the specialty when one is selected
 * (type-general services with no specialty are always included).
 */
export async function getCatalogServices(
  db: Database,
  providerType: ProviderType,
  specialty?: Specialty,
): Promise<string[]> {
  const where = specialty
    ? and(
        eq(serviceCatalog.providerType, providerType),
        or(eq(serviceCatalog.specialty, specialty), isNull(serviceCatalog.specialty)),
      )
    : eq(serviceCatalog.providerType, providerType);
  const rows = await db
    .select({ name: serviceCatalog.name })
    .from(serviceCatalog)
    .where(where)
    .orderBy(asc(serviceCatalog.sort), asc(serviceCatalog.name));
  // De-dup while preserving order.
  return [...new Set(rows.map((r) => r.name))];
}

export interface ProviderServicesResult {
  items: string[];
  source: "provider" | "catalog" | "none";
}

export async function getProviderServices(
  db: Database,
  providerId: string,
): Promise<ProviderServicesResult> {
  const [prov] = await db
    .select({ id: providers.id, providerType: providers.providerType })
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);
  if (!prov) return { items: [], source: "none" };

  const own = await db
    .select({ name: providerServices.name })
    .from(providerServices)
    .where(eq(providerServices.providerId, providerId))
    .orderBy(asc(providerServices.sort));
  if (own.length) return { items: own.map((o) => o.name), source: "provider" };

  if (!prov.providerType) return { items: [], source: "none" };
  const cat = await db
    .select({ name: serviceCatalog.name })
    .from(serviceCatalog)
    .where(eq(serviceCatalog.providerType, prov.providerType))
    .orderBy(asc(serviceCatalog.sort));
  return { items: cat.map((c) => c.name), source: "catalog" };
}
