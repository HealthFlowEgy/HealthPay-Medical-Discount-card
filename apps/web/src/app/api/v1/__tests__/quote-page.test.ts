import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "@healthpay/db";
import { partners, serviceRequests } from "@healthpay/db/schema";
import { createServiceRequest, attachOptions, getRequestById } from "@/lib/requests";
import { createQuoteToken } from "@/lib/tokens";
import { hasDb, createTestPartner, createTestOpsUser, type TestPartner } from "@/lib/__tests__/helpers";

import { GET as quoteGet } from "@/app/api/v1/quote/[token]/route";
import { POST as quoteConfirm } from "@/app/api/v1/quote/[token]/confirm/route";

const BASE = "http://localhost:3000";
const VALID_NID = "30101010123451";

/** Create a request with a known raw token (we control the token in tests). */
async function createWithToken(partner: TestPartner) {
  const db = getDb();
  const { request } = await createServiceRequest(db, partner as any, {
    serviceType: "lab_investigation",
    governorate: "Cairo",
    nationalId: VALID_NID,
    mobile: "+201001234567",
  } as any);
  // Re-issue a token we know the plaintext of.
  const tok = createQuoteToken();
  await db
    .update(serviceRequests)
    .set({ quoteTokenHash: tok.tokenHash, quoteExpiresAt: tok.expiresAt })
    .where(eq(serviceRequests.id, request.id));
  return { id: request.id, token: tok.token };
}

describe.skipIf(!hasDb)("Hosted quote page", () => {
  let partner: TestPartner;
  let opsUserId: string;

  beforeAll(async () => {
    partner = await createTestPartner();
    opsUserId = await createTestOpsUser();
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(serviceRequests).where(eq(serviceRequests.partnerId, partner.id));
    await db.delete(partners).where(eq(partners.id, partner.id));
    await closeDb();
  });

  it("returns 404 for an invalid token", async () => {
    const res = await quoteGet(new Request(`${BASE}/api/v1/quote/bogus`), {
      params: { token: "bogus-token" },
    });
    expect(res.status).toBe(404);
  });

  it("shows pending state before options, then cards after quoting", async () => {
    const db = getDb();
    const { id, token } = await createWithToken(partner);

    let res = await quoteGet(new Request(`${BASE}/api/v1/quote/${token}`), {
      params: { token },
    });
    let body = await res.json();
    expect(body.status).toBe("pending_quote");
    expect(body.options).toHaveLength(0);
    expect(body).not.toHaveProperty("nationalId"); // never exposed
    expect(body.mobile).toContain("••");

    const req = await getRequestById(db, id);
    await attachOptions(
      db,
      req!,
      [
        { providerName: "Lab A", serviceDescription: "CBC", listPrice: 500, discountedPrice: 350 },
        { providerName: "Lab B", serviceDescription: "CBC+", listPrice: 500, discountedPrice: 250 },
      ],
      opsUserId,
    );

    res = await quoteGet(new Request(`${BASE}/api/v1/quote/${token}`), { params: { token } });
    body = await res.json();
    expect(body.status).toBe("quoted");
    expect(body.options).toHaveLength(2);
  });

  it("confirms a selection via the hosted page", async () => {
    const db = getDb();
    const { id, token } = await createWithToken(partner);
    const req = await getRequestById(db, id);
    await attachOptions(
      db,
      req!,
      [{ providerName: "Lab", serviceDescription: "X", listPrice: 1000, discountedPrice: 600 }],
      opsUserId,
    );
    const quoted = await (
      await quoteGet(new Request(`${BASE}/api/v1/quote/${token}`), { params: { token } })
    ).json();
    const optionId = quoted.options[0].id;

    const res = await quoteConfirm(
      new Request(`${BASE}/api/v1/quote/${token}/confirm`, {
        method: "POST",
        body: JSON.stringify({ optionId }),
      }),
      { params: { token } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("confirmed");
    expect(body.selectedOptionId).toBe(optionId);
  });

  it("rejects confirmation on an expired token (409)", async () => {
    const db = getDb();
    const { id, token } = await createWithToken(partner);
    const req = await getRequestById(db, id);
    await attachOptions(
      db,
      req!,
      [{ providerName: "Lab", serviceDescription: "X", listPrice: 100, discountedPrice: 70 }],
      opsUserId,
    );
    await db
      .update(serviceRequests)
      .set({ quoteExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(serviceRequests.id, id));

    const quoted = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, id))
      .limit(1);
    expect(quoted[0]!.status).toBe("quoted"); // not yet lazily expired

    // GET lazily expires it.
    const getRes = await quoteGet(new Request(`${BASE}/api/v1/quote/${token}`), {
      params: { token },
    });
    expect((await getRes.json()).status).toBe("expired");
  });
});
