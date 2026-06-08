"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GOVERNORATES,
  GOVERNORATE_LABELS,
  SPECIALTIES,
  SPECIALTY_LABELS,
  PROVIDER_TYPE_LABELS,
  type ProviderType,
  type Specialty,
} from "@healthpay/shared";
import { useI18n } from "@/components/LocaleProvider";

interface DirProvider {
  id: string;
  name: string;
  area: string | null;
  providerType: ProviderType | null;
  specialty: Specialty | null;
}

const SERVICE_SUGGESTIONS = ["كشف", "تحاليل دم", "أشعة", "متابعة", "استشارة", "علاج طبيعي"];

export default function NewRequestForm() {
  const { t, L } = useI18n();
  const router = useRouter();

  const [governorate, setGovernorate] = useState("Cairo");
  const [areas, setAreas] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [providers, setProviders] = useState<DirProvider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [requestedServices, setRequestedServices] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cascading: load areas when governorate changes.
  useEffect(() => {
    setArea("");
    fetch(`/api/v1/portal/areas?governorate=${encodeURIComponent(governorate)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAreas(d.areas ?? []))
      .catch(() => setAreas([]));
  }, [governorate]);

  // Conditional: load providers when governorate/area/specialty change.
  const loadProviders = useCallback(async () => {
    const p = new URLSearchParams({ governorate, pageSize: "100" });
    if (area) p.set("area", area);
    if (specialty) p.set("specialty", specialty);
    const res = await fetch(`/api/v1/portal/providers?${p.toString()}`, { cache: "no-store" });
    const d = await res.json();
    setProviders(d.items ?? []);
    setProviderId("");
  }, [governorate, area, specialty]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const provider = providers.find((p) => p.id === providerId);
    if (!provider || !provider.providerType) {
      setError(t("portal.selectProvider"));
      return;
    }
    if (requestedServices.trim().length < 3) {
      setError(t("portal.requestedServicesNote"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/portal/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType: provider.providerType,
          specialty: provider.specialty ?? (specialty || undefined),
          governorate,
          area: area || undefined,
          providerId: provider.id,
          requestedServices: requestedServices.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to submit");
      router.push(`/portal/requests/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <h1 className="text-2xl font-bold text-navy-900">{t("portal.requestTitle")}</h1>
      <form onSubmit={submit} className="mt-5 space-y-4 rounded-xl border border-navy-100 bg-white p-6">
        {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {/* Address cascade */}
        <Field label={t("ops.col.location")}>
          <select className="sel" value={governorate} onChange={(e) => setGovernorate(e.target.value)}>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>{L(GOVERNORATE_LABELS[g])}</option>
            ))}
          </select>
        </Field>
        <Field label={t("portal.area")}>
          <select className="sel" value={area} onChange={(e) => setArea(e.target.value)} disabled={areas.length === 0}>
            <option value="">{areas.length ? t("portal.anyArea") : t("portal.anyArea")}</option>
            {areas.map((a) => (<option key={a} value={a}>{a}</option>))}
          </select>
        </Field>

        {/* Provider cascade */}
        <Field label={t("portal.specialty")}>
          <select className="sel" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            <option value="">{t("portal.anySpecialty")}</option>
            {SPECIALTIES.map((s) => (<option key={s} value={s}>{L(SPECIALTY_LABELS[s])}</option>))}
          </select>
        </Field>
        <Field label={t("portal.provider")}>
          <select className="sel" value={providerId} onChange={(e) => setProviderId(e.target.value)} required>
            <option value="">{t("portal.selectProvider")}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.providerType ? L(PROVIDER_TYPE_LABELS[p.providerType]) : ""}
                {p.area ? ` · ${p.area}` : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-navy-400">{providers.length} مقدم خدمة</span>
        </Field>

        {/* Requested services (required) */}
        <Field label={t("portal.requestedServices")} note={t("portal.requestedServicesNote")}>
          <textarea
            className="sel min-h-[80px]"
            value={requestedServices}
            onChange={(e) => setRequestedServices(e.target.value)}
            required
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SERVICE_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRequestedServices((v) => (v ? `${v}، ${s}` : s))}
                className="rounded-full border border-navy-200 px-2.5 py-0.5 text-xs text-navy-700 hover:bg-navy-50"
              >
                + {s}
              </button>
            ))}
          </div>
        </Field>

        <button type="submit" disabled={loading} className="w-full rounded-lg bg-teal-500 py-2.5 font-medium text-white hover:bg-teal-600 disabled:opacity-60">
          {loading ? t("portal.submitting") : t("portal.submitRequest")}
        </button>
      </form>
      <style jsx global>{`
        .sel { width:100%; border-radius:.5rem; border:1px solid #d4def0; padding:.5rem .75rem; font-size:.875rem; outline:none; background:#fff; }
        .sel:focus { border-color:#14B8A6; }
      `}</style>
    </main>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-navy-800">{label}</span>
      {children}
      {note && <span className="mt-1 block text-xs text-gold-500">{note}</span>}
    </label>
  );
}
