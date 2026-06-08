import * as XLSX from "xlsx";
import { opsQueueQuerySchema, PROVIDER_TYPE_LABELS } from "@healthpay/shared";
import { getDb } from "@/lib/db";
import { requireOpsUser } from "@/lib/ops-auth";
import { exportRequests } from "@/lib/ops-queue";
import { writeAudit } from "@/lib/audit";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/ops/requests/export?<filters> — Excel of the FILTERED queue only.
export async function GET(req: Request) {
  try {
    const session = await requireOpsUser();
    const db = getDb();
    const url = new URL(req.url);
    const parsed = opsQueueQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      governorate: url.searchParams.get("governorate") ?? undefined,
      providerType: url.searchParams.get("providerType") ?? undefined,
      specialty: url.searchParams.get("specialty") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    });
    const query = parsed.success ? parsed.data : { page: 1, pageSize: 25 };

    const rows = await exportRequests(db, query as never);

    const data = rows.map((r) => ({
      "اسم العميل": r.memberNameAr ?? r.memberNameEn ?? r.partnerName ?? "",
      "الرقم القومي (آخر ٤)": r.nationalIdLast4,
      "رقم الهاتف": r.mobileE164,
      "مقدم الخدمة":
        r.providerName ?? (r.providerType ? PROVIDER_TYPE_LABELS[r.providerType].ar : ""),
      "الخدمات المطلوبة": r.requestedServices ?? "",
      "الحالة": r.status,
      "المحافظة": r.governorate,
      "المنطقة": r.area ?? "",
      "التاريخ": r.createdAt.toISOString().slice(0, 16).replace("T", " "),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Requests");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const body = new Uint8Array(buf);

    await writeAudit(db, {
      actorType: "ops",
      actorId: session.userId,
      action: "requests.export",
      metadata: { count: rows.length, filters: query, by: session.email },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="healthpay-requests-${Date.now()}.xlsx"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
