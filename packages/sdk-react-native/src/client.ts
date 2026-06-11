/**
 * Headless token client (public-token mode).
 *
 * The mobile app never holds the API secret. Your backend calls
 * `hp.requests.create()` (the server SDK) and hands the resulting quote token
 * to the app; this client uses only the PUBLIC token-authenticated endpoints:
 *
 *   GET  /api/v1/quote/:token            → load the quote + options
 *   POST /api/v1/quote/:token/confirm    → confirm a selected option
 */

import { errorFromResponse, HealthPayError, NetworkError } from "./errors";
import type { Quote } from "./types";

export interface QuoteClientOptions {
  /** API base URL, e.g. "https://quotes.healthpay.example". */
  baseUrl: string;
  /** The quote token (the same one in the SMS link / `quoteUrl`). */
  token: string;
  /** Override fetch (defaults to the global `fetch`; RN provides one). */
  fetch?: typeof fetch;
  /** Per-request timeout in ms (default 15000). */
  timeoutMs?: number;
}

export interface PollOptions {
  /** Poll interval in ms (default 4000). */
  intervalMs?: number;
  /** Stop once this returns true. Defaults to terminal statuses. */
  until?: (q: Quote) => boolean;
  /** Called on each transient poll error (polling continues). */
  onError?: (err: HealthPayError) => void;
}

const TERMINAL: ReadonlySet<string> = new Set([
  "confirmed",
  "completed",
  "expired",
  "cancelled",
]);

export class HealthPayQuoteClient {
  private readonly base: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: QuoteClientOptions) {
    if (!opts.baseUrl) throw new HealthPayError("unknown", "baseUrl is required.");
    if (!opts.token) throw new HealthPayError("unknown", "token is required.");
    this.base = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? 15000;
    if (typeof this.fetchImpl !== "function") {
      throw new HealthPayError("unknown", "No fetch implementation available; pass `fetch`.");
    }
  }

  /** Load the current quote (status + pricing options). */
  get(): Promise<Quote> {
    return this.request(`/api/v1/quote/${encodeURIComponent(this.token)}`, "GET");
  }

  /** Confirm the member's selection. Throws ConflictError if not `quoted`/expired. */
  confirm(optionId: string): Promise<Quote> {
    return this.request(
      `/api/v1/quote/${encodeURIComponent(this.token)}/confirm`,
      "POST",
      { optionId },
    );
  }

  /**
   * Poll until a terminal status (or `until`) is reached. Returns a `stop()`
   * function; always call it on unmount.
   */
  poll(onUpdate: (q: Quote) => void, opts: PollOptions = {}): () => void {
    const interval = opts.intervalMs ?? 4000;
    const done = opts.until ?? ((q: Quote) => TERMINAL.has(q.status));
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stopped) return;
      try {
        const q = await this.get();
        if (stopped) return;
        onUpdate(q);
        if (done(q)) return;
      } catch (err) {
        opts.onError?.(err instanceof HealthPayError ? err : new NetworkError(String(err)));
      }
      if (!stopped) timer = setTimeout(tick, interval);
    };

    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  private async request<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      throw new NetworkError(
        (err as Error)?.name === "AbortError"
          ? `Request timed out after ${this.timeoutMs}ms.`
          : `Network request failed: ${String(err)}`,
      );
    } finally {
      clearTimeout(t);
    }

    const text = await res.text();
    const parsed = text ? safeJson(text) : undefined;
    if (!res.ok) {
      const retryAfter = Number(res.headers.get("retry-after")) || undefined;
      throw errorFromResponse(res.status, parsed as never, retryAfter);
    }
    return parsed as T;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Convenience factory. */
export function createQuoteClient(opts: QuoteClientOptions): HealthPayQuoteClient {
  return new HealthPayQuoteClient(opts);
}
