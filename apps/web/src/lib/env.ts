/** Centralised environment access with sane defaults. */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return (
      process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      required("DATABASE_URL")
    );
  },
  get appBaseUrl() {
    return process.env.APP_BASE_URL ?? "http://localhost:3000";
  },
  get quoteValidityHours() {
    return Number(process.env.QUOTE_VALIDITY_HOURS ?? 48);
  },
  get opsSessionSecret() {
    return required("OPS_SESSION_SECRET");
  },
  /** Optional gate for staff self-signup; if set, signups must supply it. */
  get opsSignupCode() {
    return process.env.OPS_SIGNUP_CODE ?? "";
  },
  get smsProvider() {
    return (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  },
  get smsSenderId() {
    return process.env.SMS_SENDER_ID ?? "HealthPay";
  },
  /** Call-center number that receives a notification on each new client request. */
  get callCenterPhone() {
    return process.env.CALL_CENTER_PHONE ?? "";
  },
  get rateLimitPerMinute() {
    return Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60);
  },
  get partnerAllowedOrigins() {
    return (process.env.PARTNER_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  /** Optional shared secret protecting internal cron endpoints. */
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
};

/** Max acceptable clock skew for partner HMAC timestamps (seconds). */
export const HMAC_MAX_SKEW_SECONDS = 5 * 60;
