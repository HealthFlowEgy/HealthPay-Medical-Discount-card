/**
 * Pluggable SMS provider abstraction.
 *
 * The provider is selected at runtime by the `SMS_PROVIDER` env var:
 *   - `console` (default): logs the message (dev)
 *   - `cequens`: real delivery via the CEQUENS SMS API
 *   - `twilio` / `smsmisr`: stub adapters
 *
 * Sends carry an optional `clientMessageId` + `dlrUrl` so providers can request
 * delivery receipts, and return the provider's own message id when available.
 */

import { env } from "../env.js";

export interface SmsSendInput {
  to: string; // E.164
  body: string;
  /** Our correlation id, echoed back by the provider's delivery receipt. */
  clientMessageId?: string;
  /** Callback URL the provider should POST/GET delivery receipts to. */
  dlrUrl?: string;
}

export interface SmsSendResult {
  providerMessageId?: string | null;
  raw?: unknown;
}

export interface SmsProvider {
  readonly name: string;
  send(input: SmsSendInput): Promise<SmsSendResult>;
}

/**
 * Choose the CEQUENS messageType. CEQUENS rejects Latin letters in `unicode`
 * mode ("Invalid Unicode data"), but accepts everything in `text` mode (it
 * auto-encodes). So use `unicode` only for pure non-Latin (Arabic) text, and
 * `text` for Latin-only or mixed Arabic+Latin messages (e.g. with a URL).
 */
function cequensMessageType(text: string): "text" | "unicode" {
  const hasNonAscii = /[^\x00-\x7F]/u.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  return hasNonAscii && !hasLatin ? "unicode" : "text";
}

/** Best-effort extraction of a message id from an unknown provider response. */
function extractMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const seen = new Set<unknown>();
  const stack: unknown[] = [payload];
  const KEYS = ["messageId", "message_id", "cequensMessageId", "id", "msgId"];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
      if (KEYS.includes(k) && (typeof v === "string" || typeof v === "number")) {
        return String(v);
      }
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return null;
}

class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    console.log(`[sms:console] -> ${input.to}\n  ${input.body}`);
    return { providerMessageId: input.clientMessageId ?? null };
  }
}

/**
 * CEQUENS SMS — https://developer.cequens.com/reference/sending-sms
 * POST https://apis.cequens.com/sms/v1/messages with Bearer auth.
 */
class CequensSmsProvider implements SmsProvider {
  readonly name = "cequens";
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const apiKey = process.env.CEQUENS_API_KEY;
    if (!apiKey) throw new Error("CEQUENS not configured (CEQUENS_API_KEY).");
    const url = process.env.CEQUENS_API_URL ?? "https://apis.cequens.com/sms/v1/messages";
    const senderName = process.env.CEQUENS_SENDER_NAME ?? env.smsSenderId;
    // CEQUENS expects the international MSISDN without a leading "+".
    const recipients = input.to.replace(/^\+/, "");

    const body: Record<string, unknown> = {
      messageText: input.body,
      senderName,
      recipients,
      messageType: cequensMessageType(input.body),
    };
    if (input.clientMessageId) {
      // CEQUENS clientMessageId is numeric; coerce when possible.
      const n = Number(input.clientMessageId);
      body.clientMessageId = Number.isFinite(n) ? n : input.clientMessageId;
    }
    if (input.dlrUrl) body.dlrUrl = input.dlrUrl;

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`CEQUENS SMS failed (${res.status}): ${JSON.stringify(raw).slice(0, 300)}`);
    }
    return { providerMessageId: extractMessageId(raw), raw };
  }
}

/** Stub: wire the Twilio REST API here (account SID / auth token from env). */
class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error("Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).");
    }
    console.warn(`[sms:twilio] stub — would send to ${input.to}`);
    return {};
  }
}

/** Stub: wire an Egyptian aggregator (SMSMisr / Victory Link) here. */
class SmsMisrProvider implements SmsProvider {
  readonly name = "smsmisr";
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const user = process.env.SMSMISR_USERNAME;
    const pass = process.env.SMSMISR_PASSWORD;
    if (!user || !pass) {
      throw new Error("SMSMisr not configured (SMSMISR_USERNAME / SMSMISR_PASSWORD).");
    }
    console.warn(`[sms:smsmisr] stub — would send to ${input.to}`);
    return {};
  }
}

let cached: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  switch (env.smsProvider) {
    case "cequens":
      cached = new CequensSmsProvider();
      break;
    case "twilio":
      cached = new TwilioSmsProvider();
      break;
    case "smsmisr":
      cached = new SmsMisrProvider();
      break;
    case "console":
    default:
      cached = new ConsoleSmsProvider();
      break;
  }
  return cached;
}
