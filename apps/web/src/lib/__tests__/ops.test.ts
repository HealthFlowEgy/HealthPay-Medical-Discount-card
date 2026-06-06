import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, closeDb } from "@healthpay/db";
import { opsUsers, partners, serviceRequests } from "@healthpay/db/schema";
import { verifyCredentials } from "@/lib/ops-auth";
import { listRequests } from "@/lib/ops-queue";
import { createServiceRequest } from "@/lib/requests";
import { hasDb, createTestPartner, type TestPartner } from "@/lib/__tests__/helpers";
import { AuthError } from "@healthpay/shared";

const VALID_NID = "30101010123451";

describe.skipIf(!hasDb)("Ops auth + queue", () => {
  let partner: TestPartner;
  let opsEmail: string;

  beforeAll(async () => {
    const db = getDb();
    partner = await createTestPartner();
    opsEmail = `ops_${Date.now()}@test.local`;
    await db.insert(opsUsers).values({
      email: opsEmail,
      passwordHash: await bcrypt.hash("secret123", 10),
      name: "Test Ops",
      role: "agent",
    });
    // Seed a couple of requests for this partner.
    await createServiceRequest(db, partner as any, {
      serviceType: "lab_investigation",
      governorate: "Cairo",
      nationalId: VALID_NID,
      mobile: "+201001234567",
    } as any);
    await createServiceRequest(db, partner as any, {
      serviceType: "dental_clinic_visit",
      governorate: "Giza",
      nationalId: VALID_NID,
      mobile: "+201007654321",
    } as any);
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(serviceRequests).where(eq(serviceRequests.partnerId, partner.id));
    await db.delete(partners).where(eq(partners.id, partner.id));
    await db.delete(opsUsers).where(eq(opsUsers.email, opsEmail));
    await closeDb();
  });

  it("verifies correct credentials", async () => {
    const session = await verifyCredentials(getDb(), opsEmail, "secret123");
    expect(session.email).toBe(opsEmail);
    expect(session.role).toBe("agent");
  });

  it("rejects wrong password", async () => {
    await expect(verifyCredentials(getDb(), opsEmail, "wrong")).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects unknown email", async () => {
    await expect(
      verifyCredentials(getDb(), "nobody@test.local", "x"),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("lists and filters the queue", async () => {
    const all = await listRequests(getDb(), { page: 1, pageSize: 100 } as any);
    expect(all.total).toBeGreaterThanOrEqual(2);

    const cairo = await listRequests(getDb(), {
      governorate: "Cairo",
      page: 1,
      pageSize: 100,
    } as any);
    expect(cairo.items.every((i) => i.governorate === "Cairo")).toBe(true);

    const byMobile = await listRequests(getDb(), {
      q: "7654321",
      page: 1,
      pageSize: 100,
    } as any);
    expect(byMobile.items.length).toBeGreaterThanOrEqual(1);
    expect(byMobile.items[0]!.mobileE164).toContain("7654321");
  });
});
