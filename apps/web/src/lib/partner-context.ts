/** Shared entry guard for partner-facing routes: read body, auth, rate-limit. */

import type { Partner } from "@healthpay/db";
import { getDb } from "./db.js";
import { authenticatePartner } from "./api-auth.js";
import { enforceRateLimit } from "./rate-limit.js";

export interface PartnerContext {
  partner: Partner;
  rawBody: string;
}

/**
 * Reads the raw request body ONCE (needed for HMAC), authenticates the partner,
 * and applies per-partner rate limiting. Routes parse `rawBody` themselves.
 */
export async function requirePartner(req: Request): Promise<PartnerContext> {
  const rawBody = await req.text();
  const db = getDb();
  const { partner } = await authenticatePartner(db, req, rawBody);
  enforceRateLimit(partner.id);
  return { partner, rawBody };
}
