/** Hashing, HMAC signing and high-entropy token helpers. */

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256Hex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

/** Constant-time comparison of two hex strings of equal length. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Generate a high-entropy, URL-safe token (default 32 bytes). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function generateApiKey(): string {
  return `hp_live_${generateToken(24)}`;
}
export function generateApiSecret(): string {
  return `hps_${generateToken(24)}`;
}
export function generateWebhookSecret(): string {
  return `whsec_${generateToken(24)}`;
}
