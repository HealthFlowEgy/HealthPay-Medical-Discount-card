import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "@healthpay/db";
import { serviceRequests, partners } from "@healthpay/db/schema";
import { attachOptions, getRequestById } from "@/lib/requests";
import {
  hasDb,
  createTestPartner,
  createTestOpsUser,
  signedRequest,
  type TestPartner,
} from "@/lib/__tests__/helpers";

import { POST as createRequestRoute } from "@/app/api/v1/requests/route";
import { GET as getRequestRoute } from "@/app/api/v1/requests/[id]/route";
import { POST as confirmRoute } from "@/app/api/v1/requests/[id]/confirm/route";
import { POST as cancelRoute } from "@/app/api/v1/requests/[id]/cancel/route";

const BASE = "http://localhost:3000";
const VALID_NID = "30101010123451"; // 2001-01-01, Cairo
const VALID_MOBILE = "+201001234567";

const validBody = {
  serviceType: "lab_investigation",
  governorate: "Cairo",
  city: "Nasr City",
  nationalId: VALID_NID,
  mobile: VALID_MOBILE,
  partnerReference: "order_test_1",
};

describe.skipIf(!hasDb)("Partner REST API", () => {
  let partner: TestPartner;
  let opsUserId: string;

  beforeAll(async () => {
    partner = await createTestPartner();
    opsUserId = await createTestOpsUser();
  });

  afterAll(async () => {
    const db = getDb();
    // service_requests FK is ON DELETE RESTRICT — remove them first (cascades
    // to pricing_options/confirmations), then the partner.
    await db.delete(serviceRequests).where(eq(serviceRequests.partnerId, partner.id));
    await db.delete(partners).where(eq(partners.id, partner.id));
    await closeDb();
  });

  it("creates a request and returns id/quote_url/expires_at", async () => {
    const res = await createRequestRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests`, validBody),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.status).toBe("pending_quote");
    expect(body.quote_url).toContain("/quote/");
    expect(body.expires_at).toBeTruthy();
  });

  it("rejects a bad HMAC signature with 401", async () => {
    const res = await createRequestRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests`, validBody, {
        signature: "deadbeef",
      }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("auth_error");
  });

  it("rejects a stale timestamp (>5min skew) with 401", async () => {
    const res = await createRequestRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests`, validBody, {
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects an invalid national ID with 422", async () => {
    const res = await createRequestRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests`, {
        ...validBody,
        nationalId: "12345678901234",
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("validation_error");
  });

  it("rejects an invalid mobile with 422", async () => {
    const res = await createRequestRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests`, {
        ...validBody,
        mobile: "01312345678",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("runs the full quote → confirm lifecycle", async () => {
    const db = getDb();
    // create
    const createRes = await createRequestRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests`, validBody),
    );
    const { id } = await createRes.json();

    // GET while pending → no options
    const pendRes = await getRequestRoute(
      signedRequest(partner, "GET", `${BASE}/api/v1/requests/${id}`),
      { params: { id } },
    );
    const pend = await pendRes.json();
    expect(pend.status).toBe("pending_quote");
    expect(pend.options).toBeUndefined();
    expect(pend.nationalIdLast4).toBe("3451");
    expect(pend.mobile).not.toBe(VALID_MOBILE); // masked

    // ops attaches options → quoted
    const req = await getRequestById(db, id);
    await attachOptions(
      db,
      req!,
      [
        { providerName: "Lab A", serviceDescription: "CBC", listPrice: 500, discountedPrice: 350 },
        { providerName: "Lab B", serviceDescription: "CBC+", listPrice: 500, discountedPrice: 300 },
      ],
      opsUserId,
    );

    const quotedRes = await getRequestRoute(
      signedRequest(partner, "GET", `${BASE}/api/v1/requests/${id}`),
      { params: { id } },
    );
    const quoted = await quotedRes.json();
    expect(quoted.status).toBe("quoted");
    expect(quoted.options).toHaveLength(2);
    const optionId = quoted.options[0].id;

    // confirm via SDK route
    const confirmRes = await confirmRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests/${id}/confirm`, { optionId }),
      { params: { id } },
    );
    expect(confirmRes.status).toBe(200);
    const confirmed = await confirmRes.json();
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.selectedOptionId).toBe(optionId);

    // confirming again is an illegal transition → 409
    const reConfirm = await confirmRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests/${id}/confirm`, { optionId }),
      { params: { id } },
    );
    expect(reConfirm.status).toBe(409);
  });

  it("rejects confirmation on an expired quote (409) and lazily expires", async () => {
    const db = getDb();
    const createRes = await createRequestRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests`, validBody),
    );
    const { id } = await createRes.json();
    const req = await getRequestById(db, id);
    await attachOptions(
      db,
      req!,
      [{ providerName: "Lab", serviceDescription: "X", listPrice: 100, discountedPrice: 70 }],
      opsUserId,
    );
    // force expiry into the past
    await db
      .update(serviceRequests)
      .set({ quoteExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(serviceRequests.id, id));

    const opts = await (await import("@/lib/requests")).getOptions(db, id);
    const confirmRes = await confirmRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests/${id}/confirm`, {
        optionId: opts[0]!.id,
      }),
      { params: { id } },
    );
    expect(confirmRes.status).toBe(409);

    // GET now lazily reports expired
    const getRes = await getRequestRoute(
      signedRequest(partner, "GET", `${BASE}/api/v1/requests/${id}`),
      { params: { id } },
    );
    expect((await getRes.json()).status).toBe("expired");
  });

  it("cancels a pending request", async () => {
    const createRes = await createRequestRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests`, validBody),
    );
    const { id } = await createRes.json();
    const res = await cancelRoute(
      signedRequest(partner, "POST", `${BASE}/api/v1/requests/${id}/cancel`),
      { params: { id } },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("cancelled");
  });
});
