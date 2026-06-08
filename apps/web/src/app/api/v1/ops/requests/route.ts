import { opsQueueQuerySchema, ValidationError } from "@healthpay/shared";
import { decryptPii } from "@healthpay/db";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { listRequests } from "@/lib/ops-queue";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/requests?status=&governorate=&service_type=&q=&page=&pageSize=
export async function GET(req: Request) {
  try {
    await requireOpsUser();
    const url = new URL(req.url);
    const parsed = opsQueueQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      governorate: url.searchParams.get("governorate") ?? undefined,
      serviceType: url.searchParams.get("serviceType") ?? undefined,
      providerType:
        url.searchParams.get("providerType") ??
        url.searchParams.get("provider_type") ??
        undefined,
      specialty: url.searchParams.get("specialty") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());

    const result = await listRequests(getDb(), parsed.data);
    return json({
      ...result,
      items: result.items.map((r) => {
        const { nationalIdEncrypted, idCardUrl, ...rest } = r;
        let nationalId: string | null = null;
        try {
          nationalId = decryptPii(nationalIdEncrypted);
        } catch {
          /* keep null */
        }
        return {
          ...rest,
          nationalId, // full national ID for the ops grid
          hasIdCard: !!idCardUrl,
          quoteExpiresAt: r.quoteExpiresAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      }),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
