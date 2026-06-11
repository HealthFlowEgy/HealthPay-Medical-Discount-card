"use client";
import Link from "next/link";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OpsSession } from "@/lib/ops-auth";
import {
  GOVERNORATES,
  GOVERNORATE_LABELS,
  PROVIDER_TYPES,
  PROVIDER_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  REQUEST_STATUSES,
  type ProviderType,
  type RequestStatus,
} from "@healthpay/shared";
import { useI18n, LanguageToggle } from "@/components/LocaleProvider";
import { STATUS_LABELS } from "@/lib/i18n";
import RequestDrawer from "./RequestDrawer";

export interface QueueItem {
  id: string;
  status: RequestStatus;
  serviceType: keyof typeof SERVICE_TYPE_LABELS;
  providerType: ProviderType | null;
  specialty: string | null;
  governorate: keyof typeof GOVERNORATE_LABELS;
  area: string | null;
  city: string | null;
  mobileE164: string;
  nationalIdLast4: string;
  nationalId: string | null;
  hasIdCard: boolean;
  memberNameAr: string | null;
  memberNameEn: string | null;
  requestedServices: string | null;
  servicesNeedsReview?: boolean;
  providerName: string | null;
  partnerReference: string | null;
  partnerName: string | null;
  quoteExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending_quote: "bg-gold-400/20 text-gold-500 border-gold-500/40",
  quoted: "bg-teal-50 text-teal-600 border-teal-500/40",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-500/40",
  completed: "bg-navy-100 text-navy-800 border-navy-800/30",
  expired: "bg-gray-100 text-gray-500 border-gray-300",
  cancelled: "bg-red-50 text-red-600 border-red-300",
};

function maskLocal(e164: string) {
  return e164.length >= 6 ? `${e164.slice(0, 5)}••••${e164.slice(-4)}` : "••••";
}

function ageLabel(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard({ user }: { user: OpsSession }) {
  const router = useRouter();
  const { t, L, locale } = useI18n();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [governorate, setGovernorate] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [connected, setConnected] = useState(false);

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (governorate) p.set("governorate", governorate);
    if (serviceType) p.set("providerType", serviceType);
    if (q) p.set("q", q);
    p.set("pageSize", "100");
    return p.toString();
  }, [status, governorate, serviceType, q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/ops/requests?${buildQuery()}`, { cache: "no-store" });
      if (res.status === 401) {
        router.push("/ops/login");
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [buildQuery, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // SSE live updates + polling fallback.
  const audioRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const es = new EventSource("/api/v1/ops/stream");
    es.addEventListener("ready", () => setConnected(true));
    const onEvent = (e: MessageEvent) => {
      if (e.type === "request.created") {
        setLiveCount((c) => c + 1);
        audioRef.current?.();
      }
      void load();
    };
    for (const t of [
      "request.created",
      "request.quoted",
      "request.confirmed",
      "request.expired",
      "request.cancelled",
      "request.updated",
    ]) {
      es.addEventListener(t, onEvent as EventListener);
    }
    es.onerror = () => setConnected(false);

    // Polling fallback every 15s in case SSE is unavailable.
    const poll = setInterval(() => void load(), 15_000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [load]);

  async function logout() {
    await fetch("/api/v1/ops/logout", { method: "POST" });
    router.push("/ops/login");
    router.refresh();
  }

  async function changeStatus(id: string, status: "completed" | "cancelled") {
    await fetch(`/api/v1/ops/requests/${id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  const counts = REQUEST_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = items.filter((i) => i.status === s).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-navy-100 bg-navy-900 px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <span className="rounded bg-teal-500 px-2 py-1 text-xs font-semibold uppercase tracking-wide">
            HealthPay
          </span>
          <h1 className="text-lg font-semibold">{t("ops.title")}</h1>
          <span
            className={`mx-2 inline-flex items-center gap-1 text-xs ${
              connected ? "text-teal-100" : "text-gold-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-teal-400" : "bg-gold-400"}`}
            />
            {connected ? t("ops.live") : t("ops.polling")}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <LanguageToggle className="text-white" />
          {user.role === "admin" && (
            <Link href="/ops/users" className="rounded bg-navy-800 px-3 py-1.5 hover:bg-navy-700">
              {t("ops.users")}
            </Link>
          )}
          <span className="text-navy-100">
            {user.name} · {user.role}
          </span>
          <button onClick={logout} className="rounded bg-navy-800 px-3 py-1.5 hover:bg-navy-700">
            {t("ops.signOut")}
          </button>
        </div>
      </header>

      {liveCount > 0 && (
        <button
          onClick={() => {
            setLiveCount(0);
            void load();
          }}
          className="block w-full bg-teal-500 py-1.5 text-center text-sm font-medium text-white"
        >
          {liveCount} {t("ops.newArrived")}
        </button>
      )}

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RequestStatus | "")}
            className="rounded-md border border-navy-100 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">{t("ops.allStatuses")}</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {(locale === "ar" ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en)} ({counts[s] ?? 0})
              </option>
            ))}
          </select>
          <select
            value={governorate}
            onChange={(e) => setGovernorate(e.target.value)}
            className="rounded-md border border-navy-100 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">{t("ops.allGovernorates")}</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {L(GOVERNORATE_LABELS[g])}
              </option>
            ))}
          </select>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="rounded-md border border-navy-100 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">{t("ops.allServices")}</option>
            {PROVIDER_TYPES.map((s) => (
              <option key={s} value={s}>
                {L(PROVIDER_TYPE_LABELS[s])}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("ops.search")}
            className="grow rounded-md border border-navy-100 bg-white px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => void load()}
            className="rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800"
          >
            {t("apply")}
          </button>
          <a
            href={`/api/v1/ops/requests/export?${buildQuery()}`}
            className="rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            ⬇ {t("ops.export")}
          </a>
        </div>

        {/* Queue table */}
        <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-700">
              <tr>
                <th className="px-4 py-2 text-start">{t("ops.col.status")}</th>
                <th className="px-4 py-2 text-start">{t("ops.col.client")}</th>
                <th className="px-4 py-2 text-start">{t("ops.col.nationalId")}</th>
                <th className="px-4 py-2 text-start">{t("ops.col.phone")}</th>
                <th className="px-4 py-2 text-start">{t("ops.col.provider")}</th>
                <th className="px-4 py-2 text-start">{t("ops.col.services")}</th>
                <th className="px-4 py-2 text-end" />
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-navy-500">
                    {t("loading")}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-navy-500">
                    {t("ops.noResults")}
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="border-t border-navy-50 hover:bg-navy-50/40">
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[it.status]}`}
                      >
                        {L(STATUS_LABELS[it.status])}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {it.memberNameAr || it.memberNameEn || it.partnerName || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{it.nationalId ?? `••• ${it.nationalIdLast4}`}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{it.mobileE164}</td>
                    <td className="px-4 py-2.5">
                      {it.providerName ??
                        (it.providerType
                          ? L(PROVIDER_TYPE_LABELS[it.providerType])
                          : L(SERVICE_TYPE_LABELS[it.serviceType]))}
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-2.5 text-navy-600" title={it.requestedServices ?? ""}>
                      {it.servicesNeedsReview && <span title={t("ops.needsReview")} className="me-1 text-gold-500">⚑</span>}
                      {it.requestedServices ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1">
                        {it.status === "confirmed" && (
                          <button onClick={() => changeStatus(it.id, "completed")} className="rounded border border-navy-300 px-2 py-1 text-xs text-navy-800 hover:bg-navy-50" title={t("ops.markCompleted")}>
                            ✓
                          </button>
                        )}
                        {["pending_quote", "quoted", "confirmed"].includes(it.status) && (
                          <button onClick={() => changeStatus(it.id, "cancelled")} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50" title={t("ops.markCancelled")}>
                            ✕
                          </button>
                        )}
                        {it.hasIdCard && (
                          <a href={`/api/v1/ops/requests/${it.id}/id-card`} target="_blank" rel="noreferrer" className="rounded border border-navy-200 px-2 py-1 text-xs text-navy-800 hover:bg-navy-50" title={t("ops.viewIdCard")}>
                            🪪
                          </a>
                        )}
                        <button onClick={() => setSelectedId(it.id)} className="rounded border border-navy-200 px-2.5 py-1 text-xs font-medium text-navy-800 hover:bg-navy-50">
                          {t("ops.viewDetails")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && (
        <RequestDrawer
          requestId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}
