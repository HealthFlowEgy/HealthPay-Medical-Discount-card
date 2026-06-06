/**
 * @healthpay/quote-sdk — official TypeScript client for the HealthPay Quote Engine.
 *
 * Quickstart:
 *
 *   import { HealthPay } from "@healthpay/quote-sdk";
 *   const hp = new HealthPay({ apiKey, apiSecret, baseUrl });
 *   const req = await hp.requests.create({
 *     serviceType: "lab_investigation",
 *     location: { governorate: "Cairo", city: "Nasr City" },
 *     nationalId: "30101010123451",
 *     mobile: "+201001234567",
 *     partnerReference: "order_8821",
 *   });
 *   // => { id, status: "pending_quote", quoteUrl, expiresAt }
 */

import { hmacSha256Hex, timingSafeEqualHex } from "./crypto.js";
import { HealthPayError, errorFromResponse } from "./errors.js";
import type {
  ClientOptions,
  CreateRequestInput,
  CreatedRequest,
  ServiceRequest,
} from "./types.js";

export * from "./types.js";
export * from "./errors.js";

const DEFAULT_TIMEOUT = 15_000;

export class HealthPay {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  readonly requests: RequestsResource;
  readonly webhooks: WebhooksResource;

  constructor(opts: ClientOptions) {
    if (!opts.apiKey || !opts.apiSecret || !opts.baseUrl) {
      throw new Error("HealthPay: apiKey, apiSecret and baseUrl are required.");
    }
    this.apiKey = opts.apiKey;
    this.apiSecret = opts.apiSecret;
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    const f = opts.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!f) throw new Error("HealthPay: no fetch implementation available.");
    this.fetchImpl = f;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;

    this.requests = new RequestsResource(this);
    this.webhooks = new WebhooksResource();
  }

  /** @internal Signed request against the partner API. */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const rawBody = body === undefined ? "" : JSON.stringify(body);
    const ts = Math.floor(Date.now() / 1000);
    const signature = await hmacSha256Hex(this.apiSecret, `${ts}.${rawBody}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-hp-key": this.apiKey,
          "x-hp-timestamp": String(ts),
          "x-hp-signature": signature,
        },
        body: method === "GET" || method === "HEAD" ? undefined : rawBody,
        signal: controller.signal,
      });
    } catch (err) {
      throw new HealthPayError(
        "network_error",
        err instanceof Error ? err.message : "Network request failed",
      );
    } finally {
      clearTimeout(timer);
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

class RequestsResource {
  constructor(private readonly client: HealthPay) {}

  /** Create a service request. Returns the id, status, quote URL and expiry. */
  async create(input: CreateRequestInput): Promise<CreatedRequest> {
    const payload = {
      serviceType: input.serviceType,
      governorate: input.location.governorate,
      city: input.location.city,
      lat: input.location.lat,
      lng: input.location.lng,
      nationalId: input.nationalId,
      mobile: input.mobile,
      partnerReference: input.partnerReference,
      note: input.note,
    };
    const res = await this.client.request<{
      id: string;
      status: CreatedRequest["status"];
      quote_url: string;
      expires_at: string;
    }>("POST", "/api/v1/requests", payload);
    return {
      id: res.id,
      status: res.status,
      quoteUrl: res.quote_url,
      expiresAt: res.expires_at,
    };
  }

  /** Fetch current status + options (if quoted/confirmed). */
  get(id: string): Promise<ServiceRequest> {
    return this.client.request<ServiceRequest>("GET", `/api/v1/requests/${id}`);
  }

  /** Programmatically confirm a selected option. */
  confirm(id: string, optionId: string): Promise<ServiceRequest> {
    return this.client.request<ServiceRequest>("POST", `/api/v1/requests/${id}/confirm`, {
      optionId,
    });
  }

  cancel(id: string): Promise<ServiceRequest> {
    return this.client.request<ServiceRequest>("POST", `/api/v1/requests/${id}/cancel`);
  }

  /**
   * Poll a request until a terminal state (or `until` returns true). Returns a
   * stop() function; the callback fires on every poll.
   */
  poll(
    id: string,
    onUpdate: (req: ServiceRequest) => void,
    opts?: { intervalMs?: number; until?: (req: ServiceRequest) => boolean },
  ): () => void {
    const interval = opts?.intervalMs ?? 5000;
    const terminal = new Set(["confirmed", "expired", "cancelled"]);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (stopped) return;
      try {
        const req = await this.get(id);
        if (stopped) return;
        onUpdate(req);
        const done = opts?.until ? opts.until(req) : terminal.has(req.status);
        if (done) return;
      } catch {
        /* swallow transient errors; keep polling */
      }
      if (!stopped) timer = setTimeout(tick, interval);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }
}

class WebhooksResource {
  /**
   * Verify an inbound webhook signature on your server.
   *
   * @param rawBody          the exact raw request body string
   * @param signatureHeader  value of `X-HP-Webhook-Signature`
   * @param timestampHeader  value of `X-HP-Webhook-Timestamp`
   * @param webhookSecret    your partner webhook secret
   * @param toleranceSeconds reject if the timestamp skew exceeds this (default 300)
   */
  async verify(
    rawBody: string,
    signatureHeader: string,
    timestampHeader: string,
    webhookSecret: string,
    toleranceSeconds = 300,
  ): Promise<boolean> {
    const ts = Number(timestampHeader);
    if (!Number.isFinite(ts)) return false;
    if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSeconds) return false;
    const expected = await hmacSha256Hex(webhookSecret, `${ts}.${rawBody}`);
    return timingSafeEqualHex(expected, signatureHeader);
  }
}
