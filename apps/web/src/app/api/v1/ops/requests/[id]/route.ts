import { eq } from "drizzle-orm";
import { maskMobile, NotFoundError } from "@healthpay/shared";
import { decryptPii } from "@healthpay/db";
import { partners } from "@healthpay/db/schema";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import {
  getRequestById,
  getOptions,
  getConfirmation,
  expireRequestIfDue,
} from "@/lib/requests";
import { serializeOption } from "@/lib/serializers";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/requests/:id?reveal=true
// Full detail. PII is masked by default; `reveal=true` decrypts it and writes an
// audit_log entry recording who revealed what.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOpsUser();
    const db = getDb();
    const reveal = new URL(req.url).searchParams.get("reveal") === "true";

    let request = await getRequestById(db, params.id);
    if (!request) throw new NotFoundError("Request not found.");
    request = await expireRequestIfDue(db, request);

    const [partner] = await db
      .select({ id: partners.id, name: partners.name })
      .from(partners)
      .where(eq(partners.id, request.partnerId))
      .limit(1);

    const options = await getOptions(db, request.id);
    const confirmation = await getConfirmation(db, request.id);

    let pii: { nationalId?: string; mobile: string };
    if (reveal) {
      pii = {
        nationalId: decryptPii(request.nationalIdEncrypted),
        mobile: decryptPii(request.mobileEncrypted),
      };
      await writeAudit(db, {
        actorType: "ops",
        actorId: session.userId,
        action: "pii.reveal",
        requestId: request.id,
        metadata: { fields: ["national_id", "mobile"], by: session.email },
      });
    } else {
      pii = { mobile: maskMobile(request.mobileE164) };
    }

    return json({
      id: request.id,
      status: request.status,
      serviceType: request.serviceType,
      governorate: request.governorate,
      city: request.city,
      lat: request.lat,
      lng: request.lng,
      partner: partner ? { id: partner.id, name: partner.name } : null,
      partnerReference: request.partnerReference,
      note: request.note,
      nationalIdLast4: request.nationalIdLast4,
      pii,
      revealed: reveal,
      options: options.map(serializeOption),
      selectedOptionId: confirmation?.selectedOptionId ?? null,
      confirmedAt: confirmation?.confirmedAt?.toISOString() ?? null,
      confirmedFrom: confirmation?.confirmedFrom ?? null,
      quoteExpiresAt: request.quoteExpiresAt.toISOString(),
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
