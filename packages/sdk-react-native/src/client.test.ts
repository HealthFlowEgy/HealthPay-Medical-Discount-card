import { describe, it, expect, vi } from "vitest";
import { createQuoteClient, HealthPayQuoteClient } from "./client";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import type { Quote } from "./types";

const quote = (status: Quote["status"], selectedOptionId: string | null = null): Quote => ({
  id: "11111111-2222-3333-4444-555555555555",
  status,
  serviceType: "lab_investigation",
  providerType: "labs",
  specialty: "labs",
  governorate: "Cairo",
  area: "Nasr City",
  city: null,
  mobile: "+20 100 •••• 567",
  memberNameEn: "Ahmed",
  memberNameAr: "أحمد",
  expiresAt: "2026-06-12T00:00:00.000Z",
  selectedOptionId,
  options: [
    {
      id: "opt-1",
      providerId: "prov-1",
      isAlternative: false,
      providerName: "Alfa Labs",
      providerAddress: "Nasr City",
      serviceDescription: "CBC",
      listPrice: 800,
      discountedPrice: 320,
      discountPct: 60,
      currency: "EGP",
      validityNote: null,
      extraInfo: null,
    },
  ],
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("HealthPayQuoteClient", () => {
  it("requires baseUrl and token", () => {
    expect(() => new HealthPayQuoteClient({ baseUrl: "", token: "t" })).toThrow();
    expect(() => new HealthPayQuoteClient({ baseUrl: "https://x", token: "" })).toThrow();
  });

  it("GETs the public token endpoint and strips a trailing slash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(quote("quoted")));
    const hp = createQuoteClient({ baseUrl: "https://x/", token: "tok 1", fetch: fetchMock });
    const q = await hp.get();
    expect(q.status).toBe("quoted");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://x/api/v1/quote/tok%201",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("confirms a selection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(quote("confirmed", "opt-1")));
    const hp = createQuoteClient({ baseUrl: "https://x", token: "t", fetch: fetchMock });
    const q = await hp.confirm("opt-1");
    expect(q.selectedOptionId).toBe("opt-1");
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ optionId: "opt-1" });
  });

  it("maps API error codes to typed errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "not_found", message: "nope" } }, 404))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "conflict", message: "bad state" } }, 409))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "validation_error", message: "pick one" } }, 422));
    const hp = createQuoteClient({ baseUrl: "https://x", token: "t", fetch: fetchMock });
    await expect(hp.get()).rejects.toBeInstanceOf(NotFoundError);
    await expect(hp.confirm("x")).rejects.toBeInstanceOf(ConflictError);
    await expect(hp.confirm("x")).rejects.toBeInstanceOf(ValidationError);
  });

  it("polls until a terminal status and then stops", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(quote("pending_quote")))
      .mockResolvedValueOnce(jsonResponse(quote("quoted")))
      .mockResolvedValueOnce(jsonResponse(quote("confirmed", "opt-1")));
    const hp = createQuoteClient({ baseUrl: "https://x", token: "t", fetch: fetchMock });

    const seen: string[] = [];
    hp.poll((q) => seen.push(q.status), { intervalMs: 1000 });

    await vi.advanceTimersByTimeAsync(0); // initial tick
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000); // would be a 4th tick, but polling stopped

    expect(seen).toEqual(["pending_quote", "quoted", "confirmed"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
