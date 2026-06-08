import { describe, it, expect, vi, afterEach } from "vitest";

// Force the CEQUENS provider and reset the module's cached singleton per test.
async function loadCequens() {
  vi.resetModules();
  process.env.SMS_PROVIDER = "cequens";
  process.env.CEQUENS_API_KEY = "test-jwt";
  process.env.SMS_SENDER_ID = "HealthPay";
  return import("../sms/index.js");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mapDlrStatus", () => {
  it("maps provider status strings to the enum", async () => {
    const { mapDlrStatus } = await import("../sms/dispatch.js");
    expect(mapDlrStatus("DELIVRD")).toBe("delivered");
    expect(mapDlrStatus("delivered")).toBe("delivered");
    expect(mapDlrStatus("UNDELIV")).toBe("undelivered");
    expect(mapDlrStatus("REJECTD")).toBe("failed");
    expect(mapDlrStatus("failed")).toBe("failed");
    expect(mapDlrStatus("EXPIRED")).toBe("failed");
    expect(mapDlrStatus("ENROUTE")).toBe("sent");
    expect(mapDlrStatus("weird")).toBe("unknown");
    expect(mapDlrStatus(undefined)).toBe("unknown");
  });
});

describe("CEQUENS SMS provider", () => {
  it("POSTs to the CEQUENS endpoint with Bearer auth and the right body", async () => {
    const { getSmsProvider } = await loadCequens();
    let captured: { url: string; init: RequestInit } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        captured = { url: String(url), init };
        return new Response(JSON.stringify({ replyCode: 0 }), { status: 200 });
      }),
    );

    const p = getSmsProvider();
    expect(p.name).toBe("cequens");
    await p.send({ to: "+201001234567", body: "هيلث باي: رابط" });

    expect(captured!.url).toBe("https://apis.cequens.com/sms/v1/messages");
    const headers = new Headers(captured!.init.headers);
    expect(headers.get("authorization")).toBe("Bearer test-jwt");
    const body = JSON.parse(String(captured!.init.body));
    expect(body.senderName).toBe("HealthPay");
    expect(body.recipients).toBe("201001234567"); // leading + stripped
    expect(body.messageType).toBe("unicode"); // Arabic content
    expect(body.messageText).toContain("هيلث باي");
  });

  it("uses messageType=text for ASCII-only content", async () => {
    const { getSmsProvider } = await loadCequens();
    let body: any = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response("{}", { status: 200 });
      }),
    );
    await getSmsProvider().send({ to: "+201112234500", body: "HealthPay link" });
    expect(body.messageType).toBe("text");
  });

  it("throws with the provider error detail on failure", async () => {
    const { getSmsProvider } = await loadCequens();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"error":{"description":"bad recipient"}}', { status: 400 })),
    );
    await expect(getSmsProvider().send({ to: "+201001234567", body: "x" })).rejects.toThrow(
      /CEQUENS SMS failed \(400\)/,
    );
  });
});
