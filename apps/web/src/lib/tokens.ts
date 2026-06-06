/** Hosted quote-page tokens: high-entropy, single-purpose, expiring. */

import { generateToken, sha256Hex } from "./crypto.js";
import { env } from "./env.js";

export interface QuoteToken {
  /** Raw token — embedded in the SMS link, never stored. */
  token: string;
  /** sha256 of the token — the only thing persisted. */
  tokenHash: string;
  expiresAt: Date;
}

export function createQuoteToken(validityHours = env.quoteValidityHours): QuoteToken {
  const token = generateToken(32);
  return {
    token,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + validityHours * 3600_000),
  };
}

export function hashQuoteToken(token: string): string {
  return sha256Hex(token);
}

export function buildQuoteUrl(token: string): string {
  return `${env.appBaseUrl.replace(/\/$/, "")}/quote/${token}`;
}
