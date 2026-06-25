/** Partner provisioning + key management (super-admin only). */

import { desc, eq } from "drizzle-orm";
import { encryptPii, type Database } from "@healthpay/db";
import { partners } from "@healthpay/db/schema";
import {
  generateApiKey,
  generateApiSecret,
  generateWebhookSecret,
  sha256Hex,
} from "./crypto";

export interface PartnerCredentials {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
}

/** Non-sensitive display hint, e.g. "hp_live_AbCdEf…". */
function keyPrefix(apiKey: string): string {
  return `${apiKey.slice(0, 14)}…`;
}

function mintCredentials(): PartnerCredentials {
  return {
    apiKey: generateApiKey(),
    apiSecret: generateApiSecret(),
    webhookSecret: generateWebhookSecret(),
  };
}

/** Partner list for the console — never returns secrets. */
export async function listPartners(db: Database) {
  return db
    .select({
      id: partners.id,
      name: partners.name,
      status: partners.status,
      apiKeyPrefix: partners.apiKeyPrefix,
      webhookUrl: partners.webhookUrl,
      createdAt: partners.createdAt,
    })
    .from(partners)
    .orderBy(desc(partners.createdAt));
}

/** Create a partner and issue fresh credentials (returned in plaintext ONCE). */
export async function createPartner(
  db: Database,
  input: { name: string; webhookUrl?: string | null },
): Promise<{ id: string; name: string } & PartnerCredentials> {
  const creds = mintCredentials();
  const [row] = await db
    .insert(partners)
    .values({
      name: input.name,
      apiKeyHash: sha256Hex(creds.apiKey),
      apiSecretEncrypted: encryptPii(creds.apiSecret),
      apiKeyPrefix: keyPrefix(creds.apiKey),
      webhookUrl: input.webhookUrl ?? null,
      webhookSecret: creds.webhookSecret,
      status: "active",
    })
    .returning({ id: partners.id, name: partners.name });
  return { id: row!.id, name: row!.name, ...creds };
}

/** Rotate ALL of a partner's credentials. The old key/secret stop working. */
export async function rotatePartnerKeys(
  db: Database,
  id: string,
): Promise<({ id: string } & PartnerCredentials) | null> {
  const creds = mintCredentials();
  const [row] = await db
    .update(partners)
    .set({
      apiKeyHash: sha256Hex(creds.apiKey),
      apiSecretEncrypted: encryptPii(creds.apiSecret),
      apiKeyPrefix: keyPrefix(creds.apiKey),
      webhookSecret: creds.webhookSecret,
    })
    .where(eq(partners.id, id))
    .returning({ id: partners.id });
  return row ? { id: row.id, ...creds } : null;
}

/** Update status (active/suspended) and/or the webhook URL. */
export async function updatePartner(
  db: Database,
  id: string,
  patch: { status?: "active" | "suspended"; webhookUrl?: string | null },
) {
  const set: Record<string, unknown> = {};
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.webhookUrl !== undefined) set.webhookUrl = patch.webhookUrl;
  if (Object.keys(set).length === 0) return null;
  const [row] = await db
    .update(partners)
    .set(set)
    .where(eq(partners.id, id))
    .returning({
      id: partners.id,
      name: partners.name,
      status: partners.status,
      webhookUrl: partners.webhookUrl,
    });
  return row ?? null;
}
