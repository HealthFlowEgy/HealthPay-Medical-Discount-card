import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  HealthPay,
  AuthError,
  ValidationError,
  RateLimitError,
  NotFoundError,
  ConflictError,
} from "./index.js";

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    handler(String(url), init ?? {}),
  ) as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const opts = { apiKey: "hp_test", apiSecret: "secret", baseUrl: "https://api.test" };

describe("HealthPay client", () => {
  it("signs requests with HMAC over `${ts}.${body}`", async () => {
    let captured: { headers: Headers; body: string } | null = null;
    const fetchImpl = mockFetch((_url, init) => {
      captured = { headers: new Headers(init.headers), body: String(init.body ?? "") };
      return jsonResponse(201, {
        id: "r1",
        status: "pending_quote",
        quote_url: "https://api.test/quote/tok",
        expires_at: "2026-06-08T00:00:00.000Z",
      });
    });
    const hp = new HealthPay({ ...opts, fetch: fetchImpl });

    const res = await hp.requests.create({
      serviceType: "lab_investigation",
      location: { governorate: "Cairo" },
      nationalId: "30101010123451",
      mobile: "+201001234567",
    });

    expect(res).toEqual({
      id: "r1",
      status: "pending_quote",
      quoteUrl: "https://api.test/quote/tok",
      expiresAt: "2026-06-08T00:00:00.000Z",
    });

    const h = captured!.headers;
    expect(h.get("x-hp-key")).toBe("hp_test");
    const ts = h.get("x-hp-timestamp")!;
    const expected = createHmac("sha256", "secret")
      .update(`${ts}.${captured!.body}`)
      .digest("hex");
    expect(h.get("x-hp-signature")).toBe(expected);
  });

  it("maps API errors to typed errors", async () => {
    const cases: Array<[number, string, any]> = [
      [401, "auth_error", AuthError],
      [422, "validation_error", ValidationError],
      [404, "not_found", NotFoundError],
      [409, "invalid_transition", ConflictError],
    ];
    for (const [status, code, Cls] of cases) {
      const hp = new HealthPay({
        ...opts,
        fetch: mockFetch(() => jsonResponse(status, { error: { code, message: "x" } })),
      });
      await expect(hp.requests.get("r1")).rejects.toBeInstanceOf(Cls);
    }
  });

  it("surfaces Retry-After on rate limits", async () => {
    const hp = new HealthPay({
      ...opts,
      fetch: mockFetch(() =>
        jsonResponse(429, { error: { code: "rate_limit", message: "slow down" } }, {
          "retry-after": "30",
        }),
      ),
    });
    try {
      await hp.requests.get("r1");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterSeconds).toBe(30);
    }
  });

  it("polls until a terminal state then stops", async () => {
    const statuses = ["quoted", "quoted", "confirmed"];
    let i = 0;
    const hp = new HealthPay({
      ...opts,
      fetch: mockFetch(() =>
        jsonResponse(200, { id: "r1", status: statuses[Math.min(i++, statuses.length - 1)] }),
      ),
    });
    const seen: string[] = [];
    await new Promise<void>((resolve) => {
      hp.requests.poll(
        "r1",
        (r) => {
          seen.push(r.status);
          if (r.status === "confirmed") setTimeout(resolve, 10);
        },
        { intervalMs: 5 },
      );
    });
    expect(seen[seen.length - 1]).toBe("confirmed");
  });
});

describe("webhooks.verify", () => {
  const secret = "whsec_test";
  const hp = new HealthPay({ ...opts, fetch: mockFetch(() => jsonResponse(200, {})) });

  it("accepts a valid signature", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ event: "request.confirmed" });
    const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(await hp.webhooks.verify(body, sig, ts, secret)).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", secret).update(`${ts}.{}`).digest("hex");
    expect(await hp.webhooks.verify('{"x":1}', sig, ts, secret)).toBe(false);
  });

  it("rejects a stale timestamp", async () => {
    const ts = String(Math.floor(Date.now() / 1000) - 9999);
    const body = "{}";
    const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(await hp.webhooks.verify(body, sig, ts, secret)).toBe(false);
  });
});
