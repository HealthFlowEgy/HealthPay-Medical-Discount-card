/** Predefined services for a provider: per-provider data if imported, else the
 *  fallback catalog keyed by the provider's type. */

import { asc, eq } from "drizzle-orm";
import type { Database } from "@healthpay/db";
import { providers, providerServices, serviceCatalog } from "@healthpay/db/schema";

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
