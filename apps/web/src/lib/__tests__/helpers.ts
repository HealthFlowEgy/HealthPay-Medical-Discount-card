/** Shared helpers for DB-backed integration tests. */

import { createHmac, createHash, randomBytes } from "node:crypto";
import { encryptPii, getDb } from "@healthpay/db";
import { partners, opsUsers } from "@healthpay/db/schema";

export const hasDb = !!process.env.DATABASE_URL && !!process.env.PII_ENCRYPTION_KEY;

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

export interface TestPartner {
  id: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
}

/** Insert a throwaway partner with known credentials. */
export async function createTestPartner(): Promise<TestPartner> {
  const db = getDb();
  const apiKey = `hp_test_${randomBytes(12).toString("hex")}`;
  const apiSecret = `hps_test_${randomBytes(12).toString("hex")}`;
  const webhookSecret = `whsec_test_${randomBytes(12).toString("hex")}`;
  const [row] = await db
    .insert(partners)
    .values({
      name: `Test Partner ${randomBytes(4).toString("hex")}`,
      apiKeyHash: sha256(apiKey),
      apiSecretEncrypted: encryptPii(apiSecret),
      webhookUrl: null,
      webhookSecret,
      status: "active",
    })
    .returning();
  return { id: row!.id, apiKey, apiSecret, webhookSecret };
}

export async function createTestOpsUser(): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(opsUsers)
    .values({
      email: `agent_${randomBytes(6).toString("hex")}@test.local`,
      passwordHash: "x",
      name: "Test Agent",
      role: "agent",
    })
    .returning();
  return row!.id;
}

/** Build a signed partner Request the way the SDK would. */
export function signedRequest(
  partner: TestPartner,
  method: string,
  url: string,
  body?: unknown,
  opts?: { timestamp?: number; signature?: string },
): Request {
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const ts = opts?.timestamp ?? Math.floor(Date.now() / 1000);
  const signature =
    opts?.signature ??
    createHmac("sha256", partner.apiSecret).update(`${ts}.${rawBody}`).digest("hex");
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-hp-key": partner.apiKey,
      "x-hp-timestamp": String(ts),
      "x-hp-signature": signature,
    },
    body: method === "GET" || method === "HEAD" ? undefined : rawBody,
  });
}
