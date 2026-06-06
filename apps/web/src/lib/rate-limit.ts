/**
 * Per-partner rate limiting (fixed-window counter).
 *
 * NOTE: This is an in-memory limiter scoped to a single server instance. On
 * Vercel's multi-instance serverless runtime it is best-effort, not global. It
 * is deliberately isolated behind this module so it can be swapped for a Redis/
 * Upstash-backed limiter without touching call sites.
 */

import { RateLimitError } from "@healthpay/shared";
import { env } from "./env.js";

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export function enforceRateLimit(
  partnerId: string,
  limit = env.rateLimitPerMinute,
): void {
  const now = Date.now();
  const key = partnerId;
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }

  if (existing.count >= limit) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    throw new RateLimitError(
      `Rate limit of ${limit} requests/minute exceeded.`,
      retryAfter,
    );
  }
  existing.count += 1;
}

/** Test helper. */
export function _resetRateLimits(): void {
  windows.clear();
}
