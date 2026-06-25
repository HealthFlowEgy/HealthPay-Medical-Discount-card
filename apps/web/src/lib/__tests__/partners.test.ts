import { describe, it, expect, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb, closeDb, decryptPii } from "@healthpay/db";
import { partners } from "@healthpay/db/schema";
import { createPartner, rotatePartnerKeys, updatePartner, listPartners } from "@/lib/partners";
import { sha256Hex } from "@/lib/crypto";
import { roleAtLeast } from "@/lib/ops-auth";
import { hasDb } from "@/lib/__tests__/helpers";

const ids: string[] = [];

describe("roleAtLeast", () => {
  it("ranks super_admin ⊇ admin ⊇ agent", () => {
    expect(roleAtLeast("super_admin", "admin")).toBe(true);
    expect(roleAtLeast("super_admin", "super_admin")).toBe(true);
    expect(roleAtLeast("admin", "agent")).toBe(true);
    expect(roleAtLeast("admin", "super_admin")).toBe(false);
    expect(roleAtLeast("agent", "admin")).toBe(false);
  });
});

describe.skipIf(!hasDb)("Partner provisioning", () => {
  afterAll(async () => {
    const db = getDb();
    if (ids.length) await db.delete(partners).where(inArray(partners.id, ids));
    await closeDb();
  });

  it("creates a partner with hashed key, encrypted secret, and a display prefix", async () => {
    const db = getDb();
    const p = await createPartner(db, { name: "TEST Partner A", webhookUrl: "https://example.com/hook" });
    ids.push(p.id);

    expect(p.apiKey).toMatch(/^hp_live_/);
    expect(p.apiSecret).toMatch(/^hps_/);
    expect(p.webhookSecret).toMatch(/^whsec_/);

    const [row] = await db.select().from(partners).where(eq(partners.id, p.id));
    expect(row!.apiKeyHash).toBe(sha256Hex(p.apiKey)); // key stored one-way
    expect(row!.apiKeyHash).not.toContain(p.apiKey);
    expect(decryptPii(row!.apiSecretEncrypted)).toBe(p.apiSecret); // secret recoverable
    expect(row!.apiKeyPrefix).toBe(`${p.apiKey.slice(0, 14)}…`);
    expect(row!.status).toBe("active");
  });

  it("rotates keys — the old key hash no longer matches", async () => {
    const db = getDb();
    const p = await createPartner(db, { name: "TEST Partner B" });
    ids.push(p.id);
    const oldHash = sha256Hex(p.apiKey);

    const rotated = await rotatePartnerKeys(db, p.id);
    expect(rotated!.apiKey).not.toBe(p.apiKey);

    const [row] = await db.select().from(partners).where(eq(partners.id, p.id));
    expect(row!.apiKeyHash).toBe(sha256Hex(rotated!.apiKey));
    expect(row!.apiKeyHash).not.toBe(oldHash);
  });

  it("suspends a partner and never lists secrets", async () => {
    const db = getDb();
    const p = await createPartner(db, { name: "TEST Partner C" });
    ids.push(p.id);

    await updatePartner(db, p.id, { status: "suspended" });
    const rows = await listPartners(db);
    const listed = rows.find((r) => r.id === p.id)!;
    expect(listed.status).toBe("suspended");
    expect(Object.keys(listed)).not.toContain("apiSecretEncrypted");
    expect(Object.keys(listed)).not.toContain("webhookSecret");
  });
});
