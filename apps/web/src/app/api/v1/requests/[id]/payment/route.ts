import { reportPaymentSchema, NotFoundError, ValidationError } from "@healthpay/shared";
import { requirePartner } from "@/lib/partner-context";
import { getDb } from "@/lib/db";
import { getRequestById, getConfirmation } from "@/lib/requests";
import { recordPayment, getLatestPayment, serializePayment } from "@/lib/payments";
import { json, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/requests/:id/payment
// The third-party app reports a payment it collected via its own PSP. HealthPay
// validates the amount against the picked offer, records it, and surfaces it in
// the ops portal. Idempotent on `providerReference`.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { partner, rawBody } = await requirePartner(req);
    const db = getDb();

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new ValidationError("Request body must be valid JSON.");
    }
    const parsed = reportPaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Validation failed", parsed.error.flatten());
    }

    const request = await getRequestById(db, params.id);
    if (!request || request.partnerId !== partner.id) {
      throw new NotFoundError("Request not found.");
    }

    const confirmation = await getConfirmation(db, request.id);
    const payment = await recordPayment(
      db,
      request,
      confirmation?.selectedOptionId ?? null,
      parsed.data,
      { actorType: "partner", actorId: partner.id },
    );

    return json(
      { requestId: request.id, status: request.status, payment: serializePayment(payment) },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

// GET /api/v1/requests/:id/payment — latest payment for the request.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { partner } = await requirePartner(req);
    const db = getDb();

    const request = await getRequestById(db, params.id);
    if (!request || request.partnerId !== partner.id) {
      throw new NotFoundError("Request not found.");
    }

    const payment = await getLatestPayment(db, request.id);
    return json({
      requestId: request.id,
      status: request.status,
      payment: payment ? serializePayment(payment) : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
