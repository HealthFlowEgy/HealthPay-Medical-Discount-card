import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "@healthpay/db";
import { partners, serviceRequests, webhookDeliveries } from "@healthpay/db/schema";
import { createServiceRequest, attachOptions, getRequestById } from "@/lib/requests";
import { createTestPartner, createTestOpsUser, hasDb, type TestPartner } from "@/lib/__tests__/helpers";

const VALID_NID = "30101010123451";

interface Received {
  signature: string | null;
  timestamp: string | null;
  event: string | null;
  rawBody: string;
}

function verifyWebhook(secret: string, ts: string, rawBody: string, signature: string) {
  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  return expected === signature;
}

describe.skipIf(!hasDb)("Webhook delivery", () => {
  let partner: TestPartner;
  let opsUserId: string;
  let server: Server;
  let port: number;
  const received: Received[] = [];

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = createServer((req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          received.push({
            signature: req.headers["x-hp-webhook-signature"] as string,
            timestamp: req.headers["x-hp-webhook-timestamp"] as string,
            event: req.headers["x-hp-event"] as string,
            rawBody: body,
          });
          res.writeHead(200);
          res.end("ok");
        });
      });
      server.listen(0, "127.0.0.1", () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });

    partner = await createTestPartner();
    opsUserId = await createTestOpsUser();
    // Point this partner's webhook at our local receiver.
    await getDb()
      .update(partners)
      .set({ webhookUrl: `http://127.0.0.1:${port}/hook` })
      .where(eq(partners.id, partner.id));
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(serviceRequests).where(eq(serviceRequests.partnerId, partner.id));
    await db.delete(partners).where(eq(partners.id, partner.id));
    await new Promise<void>((r) => server.close(() => r()));
    await closeDb();
  });

  it("delivers a signed request.quoted webhook on transition", async () => {
    const db = getDb();
    const { request } = await createServiceRequest(db, partner as any, {
      serviceType: "lab_investigation",
      governorate: "Cairo",
      nationalId: VALID_NID,
      mobile: "+201001234567",
    } as any);

    const fresh = await getRequestById(db, request.id);
    await attachOptions(
      db,
      fresh!,
      [{ providerName: "Lab", serviceDescription: "CBC", listPrice: 500, discountedPrice: 350 }],
      opsUserId,
    );

    // Delivery is fire-and-forget; poll until the row is delivered.
    let delivered = false;
    for (let i = 0; i < 40; i++) {
      const rows = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.requestId, request.id));
      if (rows.some((r) => r.status === "delivered")) {
        delivered = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(delivered).toBe(true);

    const hook = received.find((r) => r.event === "request.quoted");
    expect(hook).toBeTruthy();
    expect(verifyWebhook(partner.webhookSecret, hook!.timestamp!, hook!.rawBody, hook!.signature!)).toBe(true);

    const payload = JSON.parse(hook!.rawBody);
    expect(payload.event).toBe("request.quoted");
    expect(payload.requestId).toBe(request.id);
  });
});
