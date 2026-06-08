"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PROVIDER_TYPE_LABELS,
  GOVERNORATE_LABELS,
  type ProviderType,
  type Governorate,
  type RequestStatus,
} from "@healthpay/shared";
import { useI18n } from "@/components/LocaleProvider";
import { STATUS_LABELS } from "@/lib/i18n";

interface Req {
  id: string;
  status: RequestStatus;
  providerType: ProviderType | null;
  governorate: Governorate;
  area: string | null;
  requestedServices: string | null;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending_quote: "bg-gold-400/20 text-gold-500",
  quoted: "bg-teal-50 text-teal-600",
  confirmed: "bg-emerald-50 text-emerald-700",
  completed: "bg-navy-100 text-navy-800",
  expired: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-50 text-red-600",
};

export default function MyRequests({ clientName }: { clientName: string }) {
  const { t, L } = useI18n();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/portal/requests", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t("portal.myRequests")}</h1>
          <p className="text-sm text-navy-500">{clientName}</p>
        </div>
        <Link href="/portal/new" className="rounded-lg bg-teal-500 px-4 py-2 font-medium text-white hover:bg-teal-600">
          + {t("portal.newRequest")}
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="text-navy-500">{t("loading")}</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-navy-100 bg-white p-6 text-navy-500">{t("portal.noRequests")}</p>
        ) : (
          items.map((r) => (
            <div key={r.id} className="rounded-xl border border-navy-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">
                    {r.providerType ? L(PROVIDER_TYPE_LABELS[r.providerType]) : "—"}
                  </p>
                  <p className="text-sm text-navy-600">
                    {L(GOVERNORATE_LABELS[r.governorate])}
                    {r.area ? ` · ${r.area}` : ""}
                  </p>
                  {r.requestedServices && (
                    <p className="mt-1 truncate text-xs text-navy-400">{r.requestedServices}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status] ?? ""}`}>
                  {L(STATUS_LABELS[r.status])}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-navy-400">{new Date(r.createdAt).toLocaleString()}</span>
                <Link href={`/portal/requests/${r.id}`} className="text-sm font-medium text-teal-600 hover:underline">
                  {t("portal.viewDetails")} ›
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
