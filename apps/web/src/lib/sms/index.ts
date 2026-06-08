/**
 * Pluggable SMS provider abstraction.
 *
 * The provider is selected at runtime by the `SMS_PROVIDER` env var:
 *   - `console` (default): logs the message (dev)
 *   - `cequens`: real delivery via the CEQUENS SMS API
 *   - `twilio` / `smsmisr`: stub adapters
 */

import { env } from "../env.js";

export interface SmsMessage {
  to: string; // E.164
  body: string;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<void>;
}

/** True if the text contains non-GSM (e.g. Arabic) characters → needs unicode. */
function isUnicode(text: string): boolean {
  return /[^\x00-\x7F]/u.test(text);
}

class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send(message: SmsMessage): Promise<void> {
    console.log(`[sms:console] -> ${message.to}\n  ${message.body}`);
  }
}

/**
 * CEQUENS SMS — https://developer.cequens.com/reference/sending-sms
 * POST https://apis.cequens.com/sms/v1/messages with Bearer auth.
 */
class CequensSmsProvider implements SmsProvider {
  readonly name = "cequens";
  async send(message: SmsMessage): Promise<void> {
    const apiKey = process.env.CEQUENS_API_KEY;
    if (!apiKey) throw new Error("CEQUENS not configured (CEQUENS_API_KEY).");
    const url = process.env.CEQUENS_API_URL ?? "https://apis.cequens.com/sms/v1/messages";
    const senderName = process.env.CEQUENS_SENDER_NAME ?? env.smsSenderId;
    // CEQUENS expects the international MSISDN without a leading "+".
    const recipients = message.to.replace(/^\+/, "");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messageText: message.body,
        senderName,
        recipients,
        messageType: isUnicode(message.body) ? "unicode" : "text",
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`CEQUENS SMS failed (${res.status}): ${detail.slice(0, 300)}`);
    }
  }
}

/** Stub: wire the Twilio REST API here (account SID / auth token from env). */
class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  async send(message: SmsMessage): Promise<void> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error("Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).");
    }
    // TODO: POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
    console.warn(`[sms:twilio] stub — would send to ${message.to}`);
  }
}

/** Stub: wire an Egyptian aggregator (SMSMisr / Victory Link) here. */
class SmsMisrProvider implements SmsProvider {
  readonly name = "smsmisr";
  async send(message: SmsMessage): Promise<void> {
    const user = process.env.SMSMISR_USERNAME;
    const pass = process.env.SMSMISR_PASSWORD;
    if (!user || !pass) {
      throw new Error("SMSMisr not configured (SMSMISR_USERNAME / SMSMISR_PASSWORD).");
    }
    // TODO: POST to the aggregator's HTTP API.
    console.warn(`[sms:smsmisr] stub — would send to ${message.to}`);
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

/** Compose and send the quote-page SMS (Arabic-first for the Egyptian audience). */
export async function sendQuoteLinkSms(to: string, quoteUrl: string): Promise<void> {
  const body = `هيلث باي: عروض أسعار الخصم الطبي جاهزة. اعرض واختر الخيار المناسب: ${quoteUrl}`;
  await getSmsProvider().send({ to, body });
}
