/**
 * Pluggable SMS provider abstraction.
 *
 * The provider is selected at runtime by the `SMS_PROVIDER` env var. The default
 * `console` adapter just logs the message (dev). `twilio` and `smsmisr` are stub
 * adapters showing where a real vendor integration plugs in — no vendor is
 * hardcoded.
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

class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send(message: SmsMessage): Promise<void> {
    console.log(`[sms:console] -> ${message.to}\n  ${message.body}`);
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

/** Compose and send the quote-page SMS. */
export async function sendQuoteLinkSms(to: string, quoteUrl: string): Promise<void> {
  const body = `${env.smsSenderId}: Your medical discount pricing is ready. View and confirm your options: ${quoteUrl}`;
  await getSmsProvider().send({ to, body });
}
