import { describe, it, expect, beforeAll } from "vitest";
import {
  encryptPii,
  decryptPii,
  generatePiiKey,
  _setKeyForTesting,
} from "../crypto.js";

beforeAll(() => {
  // Inject a deterministic 32-byte key without touching process.env.
  _setKeyForTesting(Buffer.from(generatePiiKey(), "base64"));
});

describe("PII crypto (AES-256-GCM)", () => {
  it("round-trips plaintext", () => {
    const secret = "30101010123456";
    const enc = encryptPii(secret);
    expect(enc).not.toContain(secret);
    expect(decryptPii(enc)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptPii("+201001234567");
    const b = encryptPii("+201001234567");
    expect(a).not.toBe(b);
    expect(decryptPii(a)).toBe(decryptPii(b));
  });

  it("fails to decrypt tampered ciphertext (auth tag)", () => {
    const enc = encryptPii("sensitive");
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] ^= 0xff; // flip a bit in the ciphertext
    const tampered = buf.toString("base64");
    expect(() => decryptPii(tampered)).toThrow();
  });

  it("rejects malformed/too-short payloads", () => {
    expect(() => decryptPii("AAAA")).toThrow();
  });
});
