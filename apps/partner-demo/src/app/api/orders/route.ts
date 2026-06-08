import { NextResponse } from "next/server";
import { getClient } from "@/lib/healthpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/orders — the partner backend creates a HealthPay request via the SDK.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const hp = getClient();
    const created = await hp.requests.create({
      providerType: b.providerType,
      specialty: b.specialty || undefined,
      location: { governorate: b.governorate, area: b.area || undefined, city: b.city || undefined },
      nationalId: b.nationalId,
      mobile: b.mobile,
      memberNameAr: b.memberNameAr || undefined,
      memberNameEn: b.memberNameEn || undefined,
      company: b.company || undefined,
      partnerReference: b.partnerReference || `medibook_${Date.now()}`,
    });
    const token = created.quoteUrl.split("/quote/")[1] ?? "";
    return NextResponse.json({ ...created, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create request";
    const status = (err as { httpStatus?: number; status?: number })?.status ?? 400;
    return NextResponse.json({ error: message }, { status });
  }
}
