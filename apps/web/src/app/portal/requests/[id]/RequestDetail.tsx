"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PROVIDER_TYPE_LABELS,
  GOVERNORATE_LABELS,
  type ProviderType,
  type Governorate,
  type RequestStatus,
} from "@healthpay/shared";
import { useI18n } from "@/components/LocaleProvider";
import { STATUS_LABELS } from "@/lib/i18n";

interface Option {
  id: string;
  providerName: string;
  providerAddress: string | null;
  serviceDescription: string;
  listPrice: number;
  discountedPrice: number;
  discountPct: number;
  currency: string;
  isAlternative?: boolean;
}
interface Detail {
  id: string;
  status: RequestStatus;
  providerType: ProviderType | null;
  governorate: Governorate;
  area: string | null;
  requestedServices: string | null;
  options: Option[];
  selectedOptionId: string | null;
}

export default function RequestDetail({ id }: { id: string }) {
  const { t, L } = useI18n();
  const [d, setD] = useState<Detail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/portal/requests/${id}`, { cache: "no-store" });
    if (res.ok) {
      const data: Detail = await res.json();
      setD(data);
      setSelected((s) => s ?? data.selectedOptionId);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const tmr = setInterval(load, 4000);
    return () => clearInterval(tmr);
  }, [load]);

  async function confirm() {
    if (!selected) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/portal/requests/${id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionId: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed");
      setD(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setConfirming(false);
    }
  }

  if (!d) return <main className="mx-auto max-w-2xl px-5 py-8 text-navy-500">{t("loading")}</main>;

  const isQuoted = d.status === "quoted";
  const isConfirmed = d.status === "confirmed" || d.status === "completed";

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy-900">
          {d.providerType ? L(PROVIDER_TYPE_LABELS[d.providerType]) : "—"}
        </h1>
        <span className="rounded bg-navy-50 px-2 py-1 text-xs font-medium text-navy-700">
          {L(STATUS_LABELS[d.status])}
        </span>
      </div>
      <p className="mt-1 text-sm text-navy-600">
        {L(GOVERNORATE_LABELS[d.governorate])}{d.area ? ` · ${d.area}` : ""}
      </p>
      {d.requestedServices && (
        <p className="mt-2 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-700">
          <span className="font-medium">{t("portal.requestedServices")}: </span>
          {d.requestedServices}
        </p>
      )}

      {d.status === "pending_quote" && (
        <div className="mt-5 rounded-xl border border-navy-100 bg-white p-6 text-navy-600">
          {t("quote.preparingTitle")}
        </div>
      )}

      {(isQuoted || isConfirmed) && d.options.length > 0 && (
        <div className="mt-5 space-y-3">
          {isConfirmed && (
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {t("quote.thankYou")}
            </div>
          )}
          {d.options.map((o) => {
            const chosen = d.selectedOptionId === o.id;
            const sel = selected === o.id;
            return (
              <button
                key={o.id}
                type="button"
                disabled={isConfirmed}
                onClick={() => setSelected(o.id)}
                className={`block w-full rounded-xl border-2 p-4 text-start ${
                  o.isAlternative
                    ? "border-gold-500 bg-gold-400/10"
                    : chosen ? "border-emerald-500 bg-emerald-50" : sel ? "border-teal-500 bg-teal-50" : "border-navy-100 bg-white"
                } ${isConfirmed && !chosen ? "opacity-50" : ""}`}
              >
                {o.isAlternative && (
                  <div className="mb-2 inline-block rounded bg-gold-500 px-2 py-0.5 text-xs font-bold text-white">
                    ★ {t("quote.alternative")}
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-navy-900">{o.providerName}</p>
                    <p className="text-sm text-navy-600">{o.serviceDescription}</p>
                    {o.isAlternative && <p className="mt-0.5 text-xs text-gold-600">{t("quote.alternativeNote")}</p>}
                  </div>
                  <div className="text-end">
                    <p className="text-sm text-navy-400 line-through">{o.listPrice} {o.currency}</p>
                    <p className="text-lg font-bold text-teal-600">{o.discountedPrice} {o.currency}</p>
                    <span className="rounded bg-gold-400/20 px-1.5 py-0.5 text-xs font-semibold text-gold-500">
                      {t("quote.save")} {o.discountPct}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
          {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {isQuoted && (
            <button onClick={confirm} disabled={!selected || confirming} className="w-full rounded-xl bg-navy-900 py-3 font-semibold text-white hover:bg-navy-800 disabled:opacity-50">
              {confirming ? t("quote.confirming") : t("quote.confirm")}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
