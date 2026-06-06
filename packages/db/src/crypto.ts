/**
 * AES-256-GCM helpers for PII at rest (national ID, mobile).
 *
 * Ciphertext format (base64 of): [12-byte IV][16-byte auth tag][ciphertext].
 * The key comes from `PII_ENCRYPTION_KEY` (base64, 32 bytes). Decryption is only
 * ever invoked on authenticated ops reads, and every such read MUST be
 * audit-logged by the caller. Raw national IDs must never be logged.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("PII_ENCRYPTION_KEY is not set — refusing to handle PII.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `PII_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}).`,
    );
  }
  cachedKey = key;
  return key;
}

export function encryptPii(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptPii(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Ciphertext is too short / malformed.");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Test/ops helper: generate a fresh base64 key. */
export function generatePiiKey(): string {
  return randomBytes(32).toString("base64");
}

/** Allow tests to inject a key without touching process.env. */
export function _setKeyForTesting(key: Buffer | null): void {
  cachedKey = key;
}
