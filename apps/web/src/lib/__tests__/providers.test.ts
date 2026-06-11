import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { getDb, closeDb } from "@healthpay/db";
import { providers } from "@healthpay/db/schema";
import { searchProviders } from "@/lib/providers";
import { hasDb } from "@/lib/__tests__/helpers";

const ids: string[] = [];

describe.skipIf(!hasDb)("Provider directory search", () => {
  beforeAll(async () => {
    const db = getDb();
    const rows = await db
      .insert(providers)
      .values([
        { governorate: "Cairo", area: "Nasr City", providerType: "labs", specialty: "labs", specialtyRaw: "معامل تحاليل", name: "TEST Cairo Lab Alpha" },
        { governorate: "Cairo", area: "Maadi", providerType: "dental_clinics", specialty: "dentistry", specialtyRaw: "أسنان", name: "TEST Cairo Dental Beta" },
        { governorate: "Giza", area: "Dokki", providerType: "labs", specialty: "labs", specialtyRaw: "معامل تحاليل", name: "TEST Giza Lab Gamma" },
        // Duplicates of Alpha (the source directory repeats a provider once per
        // service it offers). Same name + area → must collapse to a single row.
        { governorate: "Cairo", area: "Nasr City", providerType: "labs", specialty: "labs", specialtyRaw: "أشعة", name: "TEST Cairo Lab Alpha" },
        { governorate: "Cairo", area: "Nasr City", providerType: "labs", specialty: "labs", specialtyRaw: "قلب", name: "TEST Cairo Lab Alpha" },
      ])
      .returning();
    ids.push(...rows.map((r) => r.id));
  });

  afterAll(async () => {
    const db = getDb();
    if (ids.length) await db.delete(providers).where(inArray(providers.id, ids));
    await closeDb();
  });

  it("filters by governorate + providerType", async () => {
    const res = await searchProviders(getDb(), {
      governorate: "Cairo",
      providerType: "labs",
      page: 1,
      pageSize: 100,
    });
    const names = res.items.map((p) => p.name);
    expect(names).toContain("TEST Cairo Lab Alpha");
    expect(names).not.toContain("TEST Giza Lab Gamma");
    expect(names).not.toContain("TEST Cairo Dental Beta");
  });

  it("searches by free text (name/area)", async () => {
    const res = await searchProviders(getDb(), { q: "Gamma", page: 1, pageSize: 100 });
    expect(res.items.some((p) => p.name === "TEST Giza Lab Gamma")).toBe(true);
  });

  it("filters by specialty", async () => {
    const res = await searchProviders(getDb(), { specialty: "dentistry", q: "TEST", page: 1, pageSize: 100 });
    expect(res.items.every((p) => p.specialty === "dentistry")).toBe(true);
  });

  it("deduplicates a provider repeated in the same area", async () => {
    const res = await searchProviders(getDb(), {
      governorate: "Cairo",
      providerType: "labs",
      q: "TEST Cairo Lab Alpha",
      page: 1,
      pageSize: 100,
    });
    const alpha = res.items.filter((p) => p.name === "TEST Cairo Lab Alpha");
    expect(alpha).toHaveLength(1); // 3 rows seeded → 1 returned
    expect(res.total).toBe(1); // count is distinct, not raw row count
  });
});
