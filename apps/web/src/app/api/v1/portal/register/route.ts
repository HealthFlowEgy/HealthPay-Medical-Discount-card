import { clientRegisterSchema, ValidationError } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { registerClient, setClientSession } from "@/lib/client-auth";
import { uploadIdCard, blobConfigured } from "@/lib/blob";
import { writeAudit } from "@/lib/audit";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/portal/register — multipart form (fields + idCard file).
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const parsed = clientRegisterSchema.safeParse({
      fullName: form.get("fullName"),
      nationalId: form.get("nationalId"),
      mobile: form.get("mobile"),
      whatsapp: form.get("whatsapp") ?? "true",
      password: form.get("password"),
    });
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten());
    }

    const idCard = form.get("idCard");
    let idCardUrl: string | null = null;
    if (idCard instanceof File && idCard.size > 0) {
      if (!blobConfigured()) throw new ValidationError("File storage is not configured.");
      idCardUrl = await uploadIdCard(idCard, parsed.data.nationalId.slice(-6));
    } else {
      throw new ValidationError("A clear photo of the national ID card is required.");
    }

    const db = getDb();
    const client = await registerClient(db, {
      fullName: parsed.data.fullName,
      nationalId: parsed.data.nationalId,
      mobile: parsed.data.mobile,
      whatsapp: parsed.data.whatsapp,
      password: parsed.data.password,
      idCardUrl,
    });
    await setClientSession(client);
    await writeAudit(db, {
      actorType: "user",
      actorId: client.id,
      action: "client.registered",
      metadata: { nationalIdLast4: client.nationalIdLast4 },
    });
    return json(
      { ok: true, client: { id: client.id, fullName: client.fullName } },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
