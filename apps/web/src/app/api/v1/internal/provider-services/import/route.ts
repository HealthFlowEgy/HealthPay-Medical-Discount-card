import { inArray } from "drizzle-orm";
import { normalizeArabic, governorateFromArabic } from "@healthpay/shared";
import { providers, providerServices } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Bulk-import per-provider services. Bearer CRON_SECRET.
 * Body: { items: [{ providerName, governorate?, services: string[] }], replace?: boolean }
 *
 * Providers are matched by normalized name (+ governorate when supplied). When a
 * name matches multiple branches (a chain), the services apply to all of them.
 */
export async function POST(req: Request) {
  try {
    if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
      return json({ error: { code: "auth_error", message: "Unauthorized" } }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as {
      items?: Array<{ providerName: string; governorate?: string; services: string[] }>;
      replace?: boolean;
    } | null;
    if (!body?.items?.length) {
      return json({ error: { code: "validation_error", message: "items[] required" } }, { status: 422 });
    }
    const db = getDb();

    // Build name (+ governorate) → provider id index.
    const all = await db
      .select({ id: providers.id, name: providers.name, governorate: providers.governorate })
      .from(providers);
    const byName = new Map<string, string[]>(); // normName -> ids
    const byNameGov = new Map<string, string[]>(); // normName|gov -> ids
    for (const p of all) {
      const n = normalizeArabic(p.name);
      (byName.get(n) ?? byName.set(n, []).get(n)!).push(p.id);
      if (p.governorate) {
        const k = `${n}|${p.governorate}`;
        (byNameGov.get(k) ?? byNameGov.set(k, []).get(k)!).push(p.id);
      }
    }

    const matchedProviderIds = new Set<string>();
    const rows: Array<{ providerId: string; name: string; sort: number }> = [];
    const unmatched: string[] = [];

    for (const item of body.items) {
      const n = normalizeArabic(item.providerName ?? "");
      const gov = item.governorate ? governorateFromArabic(item.governorate) : undefined;
      let ids = gov ? byNameGov.get(`${n}|${gov}`) : undefined;
      if (!ids || !ids.length) ids = byName.get(n);
      if (!ids || !ids.length) {
        unmatched.push(item.providerName);
        continue;
      }
      const services = [...new Set(item.services.map((s) => s.trim()).filter(Boolean))];
      for (const id of ids) {
        matchedProviderIds.add(id);
        services.forEach((name, i) => rows.push({ providerId: id, name, sort: i }));
      }
    }

    if (body.replace && matchedProviderIds.size) {
      await db
        .delete(providerServices)
        .where(inArray(providerServices.providerId, [...matchedProviderIds]));
    }
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 1000) {
      const batch = rows.slice(i, i + 1000);
      if (batch.length) {
        await db.insert(providerServices).values(batch);
        inserted += batch.length;
      }
    }

    return json({
      ok: true,
      matchedProviders: matchedProviderIds.size,
      servicesInserted: inserted,
      unmatchedCount: unmatched.length,
      unmatchedSample: unmatched.slice(0, 20),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
