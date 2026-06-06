"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SERVICE_TYPE_LABELS,
  MIN_DISCOUNT_PCT,
  MAX_DISCOUNT_PCT,
} from "@healthpay/shared";

interface OptionDraft {
  providerName: string;
  providerAddress: string;
  serviceDescription: string;
  listPrice: string;
  discountedPrice: string;
  validityNote: string;
}

const emptyDraft: OptionDraft = {
  providerName: "",
  providerAddress: "",
  serviceDescription: "",
  listPrice: "",
  discountedPrice: "",
  validityNote: "",
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
  const [detail, setDetail] = useState<any>(null);
  const [revealing, setRevealing] = useState(false);
  const [drafts, setDrafts] = useState<OptionDraft[]>([{ ...emptyDraft }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function submitOptions() {
    setError(null);
    const options = drafts
      .filter((d) => d.providerName && d.serviceDescription && d.listPrice && d.discountedPrice)
      .map((d) => ({
        providerName: d.providerName,
        providerAddress: d.providerAddress || undefined,
        serviceDescription: d.serviceDescription,
        listPrice: Number(d.listPrice),
        discountedPrice: Number(d.discountedPrice),
        validityNote: d.validityNote || undefined,
      }));
    if (options.length === 0) {
      setError("Add at least one complete option.");
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
      setDrafts([{ ...emptyDraft }]);
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

  if (!detail) {
    return (
      <Shell onClose={onClose}>
        <p className="p-6 text-navy-500">Loading…</p>
      </Shell>
    );
  }

  const canQuote = detail.status === "pending_quote" || detail.status === "quoted";
  const canRemove = detail.status === "quoted";

  return (
    <Shell onClose={onClose}>
      <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-navy-900">
            {SERVICE_TYPE_LABELS[detail.serviceType as keyof typeof SERVICE_TYPE_LABELS]?.en}
          </h2>
          <p className="text-sm text-navy-500">
            {detail.governorate}
            {detail.city ? ` · ${detail.city}` : ""} · {detail.status.replace("_", " ")}
          </p>
        </div>
        <button onClick={onClose} className="text-navy-400 hover:text-navy-900">
          ✕
        </button>
      </div>

      <div className="space-y-6 overflow-y-auto px-6 py-5">
        {/* Meta */}
        <section className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Partner" value={detail.partner?.name ?? "—"} />
          <Field label="Partner ref" value={detail.partnerReference ?? "—"} />
          <Field label="National ID (last 4)" value={`••• ${detail.nationalIdLast4}`} />
          <Field label="Expires" value={new Date(detail.quoteExpiresAt).toLocaleString()} />
          {detail.note && <Field label="Note" value={detail.note} className="col-span-2" />}
        </section>

        {/* PII reveal */}
        <section className="rounded-lg border border-navy-100 bg-navy-50/50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy-800">Contact details (PII)</h3>
            {!detail.revealed && (
              <button
                onClick={reveal}
                disabled={revealing}
                className="rounded bg-navy-900 px-3 py-1 text-xs font-medium text-white hover:bg-navy-800"
              >
                {revealing ? "Revealing…" : "Reveal (audited)"}
              </button>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <Field label="Mobile" value={detail.pii?.mobile ?? "—"} mono />
            <Field
              label="National ID"
              value={detail.revealed ? detail.pii?.nationalId : `••••••••• ${detail.nationalIdLast4}`}
              mono
            />
          </div>
          {detail.revealed && (
            <p className="mt-2 text-xs text-gold-500">
              This reveal has been recorded in the audit log.
            </p>
          )}
        </section>

        {/* Existing options */}
        {detail.options?.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy-800">
              Pricing options ({detail.options.length})
            </h3>
            <div className="space-y-2">
              {detail.options.map((o: any) => (
                <div
                  key={o.id}
                  className={`rounded-lg border p-3 text-sm ${
                    o.id === detail.selectedOptionId
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-navy-100"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-navy-900">{o.providerName}</p>
                      <p className="text-navy-600">{o.serviceDescription}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-navy-400 line-through">{o.listPrice} {o.currency}</p>
                      <p className="font-semibold text-teal-600">
                        {o.discountedPrice} {o.currency}{" "}
                        <span className="text-xs">(-{o.discountPct}%)</span>
                      </p>
                    </div>
                  </div>
                  {o.id === detail.selectedOptionId && (
                    <p className="mt-1 text-xs font-medium text-emerald-700">✓ Selected by user</p>
                  )}
                  {canRemove && o.id !== detail.selectedOptionId && (
                    <button
                      onClick={() => removeOption(o.id)}
                      className="mt-2 text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quote builder */}
        {canQuote && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy-800">Add pricing options</h3>
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
                        placeholder="Provider name"
                        value={d.providerName}
                        onChange={(v) => updateDraft(setDrafts, i, "providerName", v)}
                      />
                      <Input
                        placeholder="Address (optional)"
                        value={d.providerAddress}
                        onChange={(v) => updateDraft(setDrafts, i, "providerAddress", v)}
                      />
                      <Input
                        className="col-span-2"
                        placeholder="Service description"
                        value={d.serviceDescription}
                        onChange={(v) => updateDraft(setDrafts, i, "serviceDescription", v)}
                      />
                      <Input
                        placeholder="List price"
                        value={d.listPrice}
                        type="number"
                        onChange={(v) => updateDraft(setDrafts, i, "listPrice", v)}
                      />
                      <Input
                        placeholder="Discounted price"
                        value={d.discountedPrice}
                        type="number"
                        onChange={(v) => updateDraft(setDrafts, i, "discountedPrice", v)}
                      />
                      <Input
                        className="col-span-2"
                        placeholder="Validity note (optional)"
                        value={d.validityNote}
                        onChange={(v) => updateDraft(setDrafts, i, "validityNote", v)}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={outOfBand ? "text-red-600" : "text-teal-600"}>
                        {pct === null
                          ? "Enter prices to compute discount"
                          : `Discount: ${pct}%${outOfBand ? ` (must be ${MIN_DISCOUNT_PCT}–${MAX_DISCOUNT_PCT}%)` : ""}`}
                      </span>
                      {drafts.length > 1 && (
                        <button
                          onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}
                          className="text-red-600 hover:underline"
                        >
                          Remove draft
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setDrafts((ds) => [...ds, { ...emptyDraft }])}
                className="rounded border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-800 hover:bg-navy-50"
              >
                + Add another
              </button>
              <button
                onClick={submitOptions}
                disabled={saving}
                className="rounded bg-teal-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60"
              >
                {saving ? "Saving…" : detail.status === "pending_quote" ? "Send quote" : "Add options"}
              </button>
            </div>
          </section>
        )}
      </div>
    </Shell>
  );
}

function updateDraft(
  setDrafts: React.Dispatch<React.SetStateAction<OptionDraft[]>>,
  index: number,
  key: keyof OptionDraft,
  value: string,
) {
  setDrafts((ds) => ds.map((d, j) => (j === index ? { ...d, [key]: value } : d)));
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end">
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
