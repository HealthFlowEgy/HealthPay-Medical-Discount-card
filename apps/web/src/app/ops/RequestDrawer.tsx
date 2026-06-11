"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SERVICE_TYPE_LABELS,
  PROVIDER_TYPE_LABELS,
  SPECIALTY_LABELS,
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
  MIN_DISCOUNT_PCT,
  MAX_DISCOUNT_PCT,
  type ProviderType,
  type Specialty,
  type Gender,
  type MaritalStatus,
} from "@healthpay/shared";
import { useI18n } from "@/components/LocaleProvider";
import { SMS_STATUS_LABELS, STATUS_LABELS } from "@/lib/i18n";
import { parseServices } from "@/lib/services-format";

interface AuditEntry {
  action: string;
  actor: string;
  from: string | null;
  to: string | null;
  at: string;
}

interface OptionDraft {
  providerId?: string;
  providerName: string;
  providerAddress: string;
  /** One offer can cover several services (multi-select + manual additions). */
  services: string[];
  listPrice: string;
  discountedPrice: string;
  validityNote: string;
  isAlternative: boolean;
}

interface DirectoryProvider {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  providerType: ProviderType | null;
  specialty: Specialty | null;
}

const emptyDraft: OptionDraft = {
  providerName: "",
  providerAddress: "",
  services: [],
  listPrice: "",
  discountedPrice: "",
  validityNote: "",
  isAlternative: false,
};

export default function RequestDrawer({
  requestId,
  onClose,
  onChanged,
}: {
  requestId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, L, dir } = useI18n();
  const [detail, setDetail] = useState<any>(null);
  const [revealing, setRevealing] = useState(false);
  const [drafts, setDrafts] = useState<OptionDraft[]>([{ ...emptyDraft }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [providerQuery, setProviderQuery] = useState("");
  const [providerResults, setProviderResults] = useState<DirectoryProvider[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [statusBusy, setStatusBusy] = useState(false);
  const [editingServices, setEditingServices] = useState(false);
  const [serviceEdits, setServiceEdits] = useState<string[]>([]);
  const [savingServices, setSavingServices] = useState(false);
  const seededRef = useRef<string | null>(null);

  // The exact services the client selected — pre-fill + suggestions for pricing.
  const selectedServices = parseServices(detail?.requestedServices);
  const originalServiceSet = new Set(selectedServices);

  /** A pricing draft pre-filled from the client's chosen provider + services. */
  const seedDraft = useCallback((): OptionDraft => {
    const services = parseServices(detail?.requestedServices);
    return {
      ...emptyDraft,
      providerId: detail?.provider?.id,
      providerName: detail?.provider?.name ?? "",
      providerAddress: detail?.provider?.address ?? "",
      services: [...services],
    };
  }, [detail]);

  const load = useCallback(
    async (reveal = false) => {
      const res = await fetch(
        `/api/v1/ops/requests/${requestId}${reveal ? "?reveal=true" : ""}`,
        { cache: "no-store" },
      );
      setDetail(await res.json());
    },
    [requestId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const loadAudit = useCallback(async () => {
    const res = await fetch(`/api/v1/ops/requests/${requestId}/audit`, { cache: "no-store" });
    if (res.ok) setAudit((await res.json()).entries ?? []);
  }, [requestId]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  async function changeStatus(status: "completed" | "cancelled") {
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/v1/ops/requests/${requestId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await Promise.all([load(false), loadAudit()]);
        onChanged();
      }
    } finally {
      setStatusBusy(false);
    }
  }

  // Auto-suggest matching directory providers (governorate + type + specialty).
  const loadProviders = useCallback(
    async (extraQ = "") => {
      if (!detail) return;
      const p = new URLSearchParams({ pageSize: "200" });
      if (detail.governorate) p.set("governorate", detail.governorate);
      if (detail.providerType) p.set("providerType", detail.providerType);
      if (detail.specialty) p.set("specialty", detail.specialty);
      if (extraQ) p.set("q", extraQ);
      const res = await fetch(`/api/v1/ops/providers?${p.toString()}`, { cache: "no-store" });
      if (res.ok) setProviderResults((await res.json()).items ?? []);
    },
    [detail],
  );

  // Live (type-ahead) provider search: debounce the query and refetch. Fires on
  // mount with an empty query too, so the matching list loads automatically.
  useEffect(() => {
    if (!detail || !(detail.status === "pending_quote" || detail.status === "quoted")) return;
    const handle = setTimeout(() => void loadProviders(providerQuery.trim()), 250);
    return () => clearTimeout(handle);
  }, [providerQuery, detail, loadProviders]);

  // Pre-fill the first pricing draft from the client's chosen provider + service
  // (once per request), so ops mostly just enter the price.
  useEffect(() => {
    if (!detail || !(detail.status === "pending_quote" || detail.status === "quoted")) return;
    if (seededRef.current === detail.id) return;
    seededRef.current = detail.id;
    setDrafts([seedDraft()]);
  }, [detail, seedDraft]);

  async function reveal() {
    setRevealing(true);
    try {
      await load(true);
    } finally {
      setRevealing(false);
    }
  }

  function previewPct(d: OptionDraft): number | null {
    const l = Number(d.listPrice);
    const p = Number(d.discountedPrice);
    if (!l || !p || p >= l) return null;
    return Math.round(((l - p) / l) * 10000) / 100;
  }

  /** Add a draft prefilled from a directory provider. */
  function useProvider(p: DirectoryProvider) {
    setDrafts((ds) => {
      const draft: OptionDraft = {
        ...emptyDraft,
        providerId: p.id,
        providerName: p.name,
        providerAddress: p.address ?? "",
        // Pre-select the services the client actually picked.
        services: [...selectedServices],
        // A directory provider different from the client's choice = alternative.
        isAlternative: !!detail?.providerId && p.id !== detail.providerId,
      };
      // Replace the first fully-empty draft, else append.
      const idx = ds.findIndex((d) => !d.providerName && d.services.length === 0 && !d.listPrice);
      if (idx >= 0) return ds.map((d, i) => (i === idx ? draft : d));
      return [...ds, draft];
    });
  }

  async function submitOptions() {
    setError(null);
    const options = drafts
      .filter((d) => d.providerName && d.services.length > 0 && d.listPrice && d.discountedPrice)
      .map((d) => ({
        providerId: d.providerId,
        providerName: d.providerName,
        providerAddress: d.providerAddress || undefined,
        serviceDescription: d.services.join("، "),
        listPrice: Number(d.listPrice),
        discountedPrice: Number(d.discountedPrice),
        validityNote: d.validityNote || undefined,
        isAlternative: d.isAlternative,
      }));
    if (options.length === 0) {
      setError(t("drawer.enterPrices"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/ops/requests/${requestId}/options`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ options }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Failed to attach options.");
      setDrafts([seedDraft()]);
      await load(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeOption(id: string) {
    const res = await fetch(`/api/v1/ops/options/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load(false);
      onChanged();
    }
  }

  function startEditServices() {
    setServiceEdits(parseServices(detail?.requestedServices));
    setEditingServices(true);
  }

  // Ops curates the client's requested services (e.g. dropping unavailable ones).
  async function saveServices() {
    setSavingServices(true);
    try {
      const res = await fetch(`/api/v1/ops/requests/${requestId}/services`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ services: serviceEdits }),
      });
      if (res.ok) {
        setEditingServices(false);
        await load(false);
        onChanged();
      }
    } finally {
      setSavingServices(false);
    }
  }

  if (!detail) {
    return (
      <Shell onClose={onClose} dir={dir}>
        <p className="p-6 text-navy-500">{t("loading")}</p>
      </Shell>
    );
  }

  const canQuote = detail.status === "pending_quote" || detail.status === "quoted";
  const canRemove = detail.status === "quoted";
  const serviceLabel = detail.providerType
    ? L(PROVIDER_TYPE_LABELS[detail.providerType as ProviderType])
    : L(SERVICE_TYPE_LABELS[detail.serviceType as keyof typeof SERVICE_TYPE_LABELS]);

  return (
    <Shell onClose={onClose} dir={dir}>
      <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-navy-900">{serviceLabel}</h2>
          <p className="text-sm text-navy-500">
            {L(SPECIALTY_LABELS[detail.specialty as Specialty] ?? { en: "", ar: "" })}
            {detail.area ? ` · ${detail.area}` : ""}
          </p>
        </div>
        <button onClick={onClose} className="text-navy-400 hover:text-navy-900">
          ✕
        </button>
      </div>

      <div className="space-y-6 overflow-y-auto px-6 py-5">
        {/* Chosen provider — prominent at the top of the detail */}
        {detail.provider && (
          <section className="rounded-lg border border-navy-200 bg-navy-50/60 p-4">
            <p className="text-xs uppercase tracking-wide text-navy-400">{t("drawer.chosenProvider")}</p>
            <p className="mt-0.5 text-lg font-bold text-navy-900">{detail.provider.name}</p>
            <p className="text-sm text-navy-500">
              {[detail.provider.area, detail.provider.address].filter(Boolean).join(" · ") ||
                detail.area ||
                ""}
            </p>
          </section>
        )}

        {/* Meta */}
        <section className="grid grid-cols-2 gap-3 text-sm">
          <Field label={t("drawer.partner")} value={detail.partner?.name ?? "—"} />
          <Field label={t("drawer.partnerRef")} value={detail.partnerReference ?? "—"} />
          <Field label={t("drawer.specialty")} value={detail.specialty ? L(SPECIALTY_LABELS[detail.specialty as Specialty]) : "—"} />
          <Field label={t("drawer.area")} value={detail.area ?? "—"} />
          <Field label={t("drawer.nid4")} value={`••• ${detail.nationalIdLast4}`} />
          <Field label={t("drawer.expires")} value={new Date(detail.quoteExpiresAt).toLocaleString()} />
          <Field
            label={t("drawer.sms")}
            value={detail.sms ? L(SMS_STATUS_LABELS[detail.sms.status] ?? SMS_STATUS_LABELS.unknown) : "—"}
          />
          {detail.note && <Field label={t("drawer.note")} value={detail.note} className="col-span-2" />}
        </section>

        {/* Requested services — front and centre for pricing; ops may curate them */}
        {(detail.requestedServices || canQuote) && (
          <section className={`rounded-lg border-2 p-4 ${detail.servicesNeedsReview ? "border-gold-500 bg-gold-400/10" : "border-teal-500/40 bg-teal-50/50"}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy-800">{t("drawer.requestedServices")}</h3>
              <div className="flex items-center gap-2">
                {detail.servicesNeedsReview && (
                  <span className="rounded bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold text-white">⚑ {t("ops.needsReview")}</span>
                )}
                {canQuote && !editingServices && (
                  <button onClick={startEditServices} className="text-xs font-medium text-teal-600 hover:underline">
                    ✎ {t("drawer.editServices")}
                  </button>
                )}
              </div>
            </div>

            {editingServices ? (
              <div className="mt-2">
                <ServiceMultiSelect
                  options={selectedServices}
                  value={serviceEdits}
                  onChange={setServiceEdits}
                  t={t}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={saveServices}
                    disabled={savingServices}
                    className="rounded bg-teal-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60"
                  >
                    {savingServices ? t("drawer.saving") : t("drawer.saveServices")}
                  </button>
                  <button
                    onClick={() => setEditingServices(false)}
                    className="rounded border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-800 hover:bg-navy-50"
                  >
                    {t("drawer.cancelEdit")}
                  </button>
                </div>
              </div>
            ) : selectedServices.length > 0 ? (
              <ol className="mt-2 space-y-1">
                {selectedServices.map((s, i) => (
                  <li
                    key={`${s}-${i}`}
                    className="flex items-start gap-2 rounded border border-navy-100 bg-white px-2.5 py-1.5 text-sm text-navy-900"
                  >
                    <span className="mt-0.5 text-xs font-semibold text-navy-400">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-navy-400">{t("drawer.noServicesYet")}</p>
            )}
          </section>
        )}

        {/* Member */}
        <section className="rounded-lg border border-navy-100 p-4">
          <h3 className="mb-2 text-sm font-semibold text-navy-800">{t("drawer.member")}</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="الاسم" value={detail.memberNameAr ?? "—"} />
            <Field label="Name" value={detail.memberNameEn ?? "—"} />
            <Field label={t("drawer.company")} value={detail.company ?? "—"} />
            <Field
              label={t("drawer.gender")}
              value={detail.gender ? L(GENDER_LABELS[detail.gender as Gender]) : "—"}
            />
            <Field
              label={t("drawer.maritalStatus")}
              value={detail.maritalStatus ? L(MARITAL_STATUS_LABELS[detail.maritalStatus as MaritalStatus]) : "—"}
            />
          </div>
        </section>

        {/* PII reveal */}
        <section className="rounded-lg border border-navy-100 bg-navy-50/50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy-800">{t("drawer.contactPii")}</h3>
            {!detail.revealed && (
              <button
                onClick={reveal}
                disabled={revealing}
                className="rounded bg-navy-900 px-3 py-1 text-xs font-medium text-white hover:bg-navy-800"
              >
                {revealing ? t("drawer.revealing") : t("drawer.reveal")}
              </button>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <Field label={t("drawer.mobile")} value={detail.pii?.mobile ?? "—"} mono />
            <Field
              label={t("drawer.nationalId")}
              value={detail.revealed ? detail.pii?.nationalId : `••••••••• ${detail.nationalIdLast4}`}
              mono
            />
          </div>
          {detail.revealed && (
            <p className="mt-2 text-xs text-gold-500">{t("drawer.revealNote")}</p>
          )}
        </section>

        {/* Existing options */}
        {detail.options?.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy-800">
              {t("drawer.options")} ({detail.options.length})
            </h3>
            <div className="space-y-2">
              {detail.options.map((o: any) => (
                <div
                  key={o.id}
                  className={`rounded-lg border p-3 text-sm ${
                    o.isAlternative
                      ? "border-gold-500 bg-gold-400/10"
                      : o.id === detail.selectedOptionId
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-navy-100"
                  }`}
                >
                  {o.isAlternative && (
                    <div className="mb-1 inline-block rounded bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      ★ {t("quote.alternative")}
                    </div>
                  )}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-navy-900">{o.providerName}</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {parseServices(o.serviceDescription).map((s: string, k: number) => (
                          <li key={k} className="flex items-center gap-1.5 text-navy-600">
                            <span>• {s}</span>
                            {!originalServiceSet.has(s) && (
                              <span className="rounded bg-gold-400/30 px-1 py-0.5 text-[9px] font-bold text-gold-600">
                                + {t("drawer.addedService")}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-end">
                      <p className="text-navy-400 line-through">{o.listPrice} {o.currency}</p>
                      <p className="font-semibold text-teal-600">
                        {o.discountedPrice} {o.currency}{" "}
                        <span className="text-xs">(-{o.discountPct}%)</span>
                      </p>
                    </div>
                  </div>
                  {o.id === detail.selectedOptionId && (
                    <p className="mt-1 text-xs font-medium text-emerald-700">{t("drawer.selectedByUser")}</p>
                  )}
                  {canRemove && o.id !== detail.selectedOptionId && (
                    <button
                      onClick={() => removeOption(o.id)}
                      className="mt-2 text-xs text-red-600 hover:underline"
                    >
                      {t("remove")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Provider picker (directory matching) */}
        {canQuote && (
          <section className="rounded-lg border border-teal-500/30 bg-teal-50/40 p-4">
            <h3 className="mb-2 text-sm font-semibold text-navy-800">{t("drawer.findProvider")}</h3>
            <div className="flex gap-2">
              <input
                value={providerQuery}
                onChange={(e) => setProviderQuery(e.target.value)}
                placeholder={t("drawer.searchProviders")}
                className="grow rounded-md border border-navy-100 px-2.5 py-1.5 text-sm"
              />
              <button
                onClick={() => void loadProviders(providerQuery)}
                className="rounded bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800"
              >
                {t("apply")}
              </button>
            </div>
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
              {providerResults.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded border border-navy-100 bg-white px-2.5 py-1.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{p.name}</p>
                    <p className="truncate text-xs text-navy-500">
                      {p.area ?? ""}
                      {p.specialty ? ` · ${L(SPECIALTY_LABELS[p.specialty])}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => useProvider(p)}
                    className="ms-2 shrink-0 rounded bg-teal-500 px-2 py-1 text-xs font-medium text-white hover:bg-teal-600"
                  >
                    {t("drawer.use")}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quote builder */}
        {canQuote && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy-800">{t("drawer.addOptions")}</h3>
            {error && (
              <div className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div className="space-y-4">
              {drafts.map((d, i) => {
                const pct = previewPct(d);
                const outOfBand =
                  pct !== null && (pct < MIN_DISCOUNT_PCT || pct > MAX_DISCOUNT_PCT);
                return (
                  <div key={i} className="rounded-lg border border-navy-100 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder={t("drawer.providerName")}
                        value={d.providerName}
                        onChange={(v) => updateDraft(setDrafts, i, "providerName", v)}
                      />
                      <Input
                        placeholder={t("drawer.address")}
                        value={d.providerAddress}
                        onChange={(v) => updateDraft(setDrafts, i, "providerAddress", v)}
                      />
                      <div className="col-span-2">
                        <p className="mb-1 text-xs font-medium text-navy-600">{t("drawer.servicesInOffer")}</p>
                        <ServiceMultiSelect
                          options={selectedServices}
                          value={d.services}
                          onChange={(next) =>
                            setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, services: next } : x)))
                          }
                          t={t}
                        />
                      </div>
                      <Input
                        placeholder={t("drawer.listPrice")}
                        value={d.listPrice}
                        type="number"
                        onChange={(v) => updateDraft(setDrafts, i, "listPrice", v)}
                      />
                      <Input
                        placeholder={t("drawer.discountedPrice")}
                        value={d.discountedPrice}
                        type="number"
                        onChange={(v) => updateDraft(setDrafts, i, "discountedPrice", v)}
                      />
                      <Input
                        className="col-span-2"
                        placeholder={t("drawer.validityNote")}
                        value={d.validityNote}
                        onChange={(v) => updateDraft(setDrafts, i, "validityNote", v)}
                      />
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-xs text-gold-600">
                      <input
                        type="checkbox"
                        checked={d.isAlternative}
                        onChange={(e) =>
                          setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, isAlternative: e.target.checked } : x)))
                        }
                      />
                      ★ {t("drawer.markAlternative")}
                    </label>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={outOfBand ? "text-red-600" : "text-teal-600"}>
                        {pct === null
                          ? t("drawer.enterPrices")
                          : `${t("drawer.discount")}: ${pct}%${outOfBand ? ` (${MIN_DISCOUNT_PCT}–${MAX_DISCOUNT_PCT}%)` : ""}`}
                      </span>
                      {drafts.length > 1 && (
                        <button
                          onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}
                          className="text-red-600 hover:underline"
                        >
                          {t("drawer.removeDraft")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setDrafts((ds) => [...ds, { ...emptyDraft, services: [...selectedServices] }])}
                className="rounded border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-800 hover:bg-navy-50"
              >
                {t("drawer.addAnother")}
              </button>
              <button
                onClick={submitOptions}
                disabled={saving}
                className="rounded bg-teal-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60"
              >
                {saving
                  ? t("drawer.saving")
                  : detail.status === "pending_quote"
                    ? t("drawer.sendQuote")
                    : t("drawer.addMore")}
              </button>
            </div>
          </section>
        )}

        {/* Status actions: Completed / Cancelled */}
        {(detail.status === "confirmed" ||
          detail.status === "quoted" ||
          detail.status === "pending_quote") && (
          <section className="flex flex-wrap gap-2">
            {detail.status === "confirmed" && (
              <button
                onClick={() => changeStatus("completed")}
                disabled={statusBusy}
                className="rounded-lg bg-navy-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
              >
                ✓ {t("ops.markCompleted")}
              </button>
            )}
            <button
              onClick={() => changeStatus("cancelled")}
              disabled={statusBusy}
              className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              ✕ {t("ops.markCancelled")}
            </button>
          </section>
        )}

        {/* Audit trail */}
        {audit.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy-800">{t("ops.auditTrail")}</h3>
            <ul className="space-y-1.5">
              {audit.map((e, i) => (
                <li key={i} className="rounded border border-navy-100 bg-navy-50/40 px-2.5 py-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-navy-800">
                      {e.from && e.to ? (
                        <>
                          {L(STATUS_LABELS[e.from as keyof typeof STATUS_LABELS] ?? { en: e.from, ar: e.from })}
                          {" → "}
                          {L(STATUS_LABELS[e.to as keyof typeof STATUS_LABELS] ?? { en: e.to, ar: e.to })}
                        </>
                      ) : (
                        e.action
                      )}
                    </span>
                    <span className="text-navy-400">{new Date(e.at).toLocaleString()}</span>
                  </div>
                  <span className="text-navy-500">{e.actor}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Shell>
  );
}

type DraftStringKey =
  | "providerName"
  | "providerAddress"
  | "listPrice"
  | "discountedPrice"
  | "validityNote";

function updateDraft(
  setDrafts: React.Dispatch<React.SetStateAction<OptionDraft[]>>,
  index: number,
  key: DraftStringKey,
  value: string,
) {
  setDrafts((ds) => ds.map((d, j) => (j === index ? { ...d, [key]: value } : d)));
}

/**
 * Multi-select for an offer's services: toggleable suggestions (the client's
 * picks) + manual additions for services the client didn't request.
 */
function ServiceMultiSelect({
  options,
  value,
  onChange,
  t,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  t: (key: string) => string;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const has = (s: string) => value.includes(s);
  const toggle = (s: string) => onChange(has(s) ? value.filter((x) => x !== s) : [...value, s]);
  const add = () => {
    const v = text.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setText("");
    setAdding(false);
  };
  // Services in the offer that the client did not originally request.
  const custom = value.filter((v) => !options.includes(v));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              has(s) ? "border-teal-500 bg-teal-500 text-white" : "border-navy-200 text-navy-700 hover:bg-navy-50"
            }`}
          >
            {has(s) ? "✓ " : "+ "}
            {s}
          </button>
        ))}
        {custom.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className="rounded-full border border-gold-500 bg-gold-400/20 px-2.5 py-1 text-xs text-gold-600"
          >
            ★ {s} ✕
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className={`rounded-full border px-2.5 py-1 text-xs ${
            adding ? "border-gold-500 bg-gold-500 text-white" : "border-dashed border-gold-500 text-gold-600 hover:bg-gold-400/10"
          }`}
        >
          + {t("drawer.addService")}
        </button>
      </div>
      {adding && (
        <div className="mt-1.5 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={t("drawer.newServiceName")}
            className="grow rounded-md border border-navy-100 px-2.5 py-1.5 text-sm outline-none focus:border-teal-500"
          />
          <button
            type="button"
            onClick={add}
            className="shrink-0 rounded-md border border-navy-200 px-3 text-sm text-navy-800 hover:bg-navy-50"
          >
            {t("drawer.add")}
          </button>
        </div>
      )}
    </div>
  );
}

function Shell({
  children,
  onClose,
  dir,
}: {
  children: React.ReactNode;
  onClose: () => void;
  dir: "rtl" | "ltr";
}) {
  return (
    <div className="fixed inset-0 z-20 flex" style={{ justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
      <div className="absolute inset-0 bg-navy-900/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wide text-navy-400">{label}</p>
      <p className={`text-navy-900 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-navy-100 px-2.5 py-1.5 text-sm outline-none focus:border-teal-500 ${className}`}
    />
  );
}
