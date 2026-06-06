/**
 * Partner authentication: API key + HMAC request signature.
 *
 * Headers:
 *   X-HP-Key        the partner's API key (looked up by sha256 hash)
 *   X-HP-Timestamp  unix seconds; rejected if skew > 5 min
 *   X-HP-Signature  hex HMAC-SHA256 over `${timestamp}.${rawBody}` using the
 *                   partner's API secret
 *
 * The signed payload binds the timestamp and the exact body, preventing replay
 * (via skew window) and tampering. GET requests sign over an empty body.
 */

import { eq } from "drizzle-orm";
import { AuthError } from "@healthpay/shared";
import { decryptPii, type Database, type Partner } from "@healthpay/db";
import { partners } from "@healthpay/db/schema";
import { sha256Hex, hmacSha256Hex, safeEqualHex } from "./crypto.js";
import { HMAC_MAX_SKEW_SECONDS } from "./env.js";

export interface AuthedPartner {
  partner: Partner;
}

/**
 * Authenticate a partner request. `rawBody` MUST be the exact string the
 * signature was computed over (read once by the caller).
 */
export async function authenticatePartner(
  db: Database,
  req: Request,
  rawBody: string,
): Promise<AuthedPartner> {
  const apiKey = req.headers.get("x-hp-key");
  const timestamp = req.headers.get("x-hp-timestamp");
  const signature = req.headers.get("x-hp-signature");

  if (!apiKey || !timestamp || !signature) {
    throw new AuthError("Missing X-HP-Key, X-HP-Timestamp or X-HP-Signature header.");
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    throw new AuthError("X-HP-Timestamp must be a unix timestamp (seconds).");
  }
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skew > HMAC_MAX_SKEW_SECONDS) {
    throw new AuthError("Request timestamp is outside the allowed 5-minute window.");
  }

  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.apiKeyHash, sha256Hex(apiKey)))
    .limit(1);

  if (!partner) throw new AuthError("Unknown API key.");
  if (partner.status !== "active") throw new AuthError("Partner account is suspended.");

  // Recover the partner's HMAC signing key (stored encrypted) and recompute the
  // expected signature over `${timestamp}.${rawBody}`, then constant-time compare.
  const secret = decryptPii(partner.apiSecretEncrypted);
  const expected = hmacSha256Hex(secret, `${ts}.${rawBody}`);
  if (!safeEqualHex(expected, signature)) {
    throw new AuthError("Invalid request signature.");
  }

  return { partner };
}
