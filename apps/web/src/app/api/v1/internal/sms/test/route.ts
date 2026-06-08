import { normalizeEgyptianMobile, ValidationError } from "@healthpay/shared";
import { getSmsProvider } from "@/lib/sms";
import { env } from "@/lib/env";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guarded SMS smoke test:  POST /api/v1/internal/sms/test?to=+201001234567
 * Authorization: Bearer <CRON_SECRET>. Sends one message via the configured
 * provider and reports success or the provider's error (no request is created).
 */
function authorized(req: Request): boolean {
  return !!env.cronSecret && req.headers.get("authorization") === `Bearer ${env.cronSecret}`;
}

export async function POST(req: Request) {
  try {
    if (!authorized(req)) {
      return json({ error: { code: "auth_error", message: "Unauthorized" } }, { status: 401 });
    }
    const to = new URL(req.url).searchParams.get("to") ?? "";
    const norm = normalizeEgyptianMobile(to);
    if (!norm.ok) throw new ValidationError(norm.reason);

    const provider = getSmsProvider();
    const body = `هيلث باي: رسالة اختبار. HealthPay test message.`;
    try {
      await provider.send({ to: norm.e164, body });
      return json({ ok: true, provider: provider.name, to: norm.e164 });
    } catch (err) {
      return json(
        {
          ok: false,
          provider: provider.name,
          to: norm.e164,
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 502 },
      );
    }
  } catch (err) {
    return errorResponse(err);
  }
}
