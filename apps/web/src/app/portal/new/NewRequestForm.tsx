"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GOVERNORATES,
  GOVERNORATE_LABELS,
  PROVIDER_TYPES,
  PROVIDER_TYPE_LABELS,
  SPECIALTIES,
  SPECIALTY_LABELS,
  specialtyRequiredFor,
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

export default function NewRequestForm() {
  const { t, L } = useI18n();
  const router = useRouter();

  const [providerType, setProviderType] = useState<ProviderType>("labs");
  const [specialty, setSpecialty] = useState("");
  const [governorate, setGovernorate] = useState("Cairo");
  const [areas, setAreas] = useState<string[]>([]);
  const [area, setArea] = useState("");

  const [providerQuery, setProviderQuery] = useState("");
  const [providerResults, setProviderResults] = useState<DirProvider[]>([]);
  const [provider, setProvider] = useState<DirProvider | null>(null);

  const [catalog, setCatalog] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [manualService, setManualService] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const specialtyRequired = specialtyRequiredFor(providerType);

  // Cascading: areas per governorate.
  useEffect(() => {
    setArea("");
    fetch(`/api/v1/portal/areas?governorate=${encodeURIComponent(governorate)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAreas(d.areas ?? []))
      .catch(() => setAreas([]));
  }, [governorate]);

  // Reset provider selection when filters change.
  useEffect(() => {
    setProvider(null);
    setCatalog([]);
    setSelectedServices([]);
  }, [providerType, specialty, governorate, area]);

  // Typeahead provider search (debounced).
  useEffect(() => {
    if (provider) return; // don't search while one is selected
    const handle = setTimeout(async () => {
      const p = new URLSearchParams({ governorate, providerType, pageSize: "50" });
      if (area) p.set("area", area);
      if (specialty) p.set("specialty", specialty);
      if (providerQuery.trim()) p.set("q", providerQuery.trim());
      const res = await fetch(`/api/v1/portal/providers?${p.toString()}`, { cache: "no-store" });
      const d = await res.json();
      setProviderResults(d.items ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [providerQuery, providerType, specialty, governorate, area, provider]);

  const selectProvider = useCallback(async (p: DirProvider) => {
    setProvider(p);
    setProviderResults([]);
    const res = await fetch(`/api/v1/portal/providers/${p.id}/services`, { cache: "no-store" });
    const d = await res.json();
    setCatalog(d.items ?? []);
  }, []);

  function toggleService(name: string) {
    setSelectedServices((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));
  }
  function addManual() {
    const v = manualService.trim();
    if (v && !selectedServices.includes(v)) setSelectedServices((s) => [...s, v]);
    setManualService("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (specialtyRequired && !specialty) { setError(t("portal.specialty")); return; }
    if (!provider) { setError(t("portal.selectProvider")); return; }
    if (selectedServices.length === 0) { setError(t("portal.requestedServicesNote")); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/portal/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType,
          specialty: specialty || provider.specialty || undefined,
          governorate,
          area: area || undefined,
          providerId: provider.id,
          requestedServices: selectedServices.join("، "),
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

        {/* Provider type FIRST */}
        <Field label={t("portal.providerType")}>
          <select className="sel" value={providerType} onChange={(e) => setProviderType(e.target.value as ProviderType)}>
            {PROVIDER_TYPES.map((p) => (<option key={p} value={p}>{L(PROVIDER_TYPE_LABELS[p])}</option>))}
          </select>
        </Field>

        {/* Specialty (conditional required) */}
        <Field label={`${t("portal.specialty")}${specialtyRequired ? " *" : ""}`}>
          <select className="sel" value={specialty} onChange={(e) => setSpecialty(e.target.value)} required={specialtyRequired}>
            <option value="">{specialtyRequired ? t("portal.selectProvider") : t("portal.anySpecialty")}</option>
            {SPECIALTIES.map((s) => (<option key={s} value={s}>{L(SPECIALTY_LABELS[s])}</option>))}
          </select>
        </Field>

        {/* Address cascade */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ops.col.location")}>
            <select className="sel" value={governorate} onChange={(e) => setGovernorate(e.target.value)}>
              {GOVERNORATES.map((g) => (<option key={g} value={g}>{L(GOVERNORATE_LABELS[g])}</option>))}
            </select>
          </Field>
          <Field label={t("portal.area")}>
            <select className="sel" value={area} onChange={(e) => setArea(e.target.value)} disabled={areas.length === 0}>
              <option value="">{t("portal.anyArea")}</option>
              {areas.map((a) => (<option key={a} value={a}>{a}</option>))}
            </select>
          </Field>
        </div>

        {/* Provider typeahead */}
        <Field label={t("portal.provider")}>
          {provider ? (
            <div className="flex items-center justify-between rounded-lg border border-teal-500 bg-teal-50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-navy-900">{provider.name}</p>
                <p className="truncate text-xs text-navy-500">{provider.area ?? ""}</p>
              </div>
              <button type="button" onClick={() => { setProvider(null); setCatalog([]); setSelectedServices([]); }} className="text-xs text-teal-600 underline">
                {t("portal.change")}
              </button>
            </div>
          ) : (
            <>
              <input className="sel" value={providerQuery} onChange={(e) => setProviderQuery(e.target.value)} placeholder={t("portal.searchProvider")} />
              <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-navy-100">
                {providerResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-navy-400">{t("portal.noResults")}</p>
                ) : (
                  providerResults.map((p) => (
                    <button key={p.id} type="button" onClick={() => selectProvider(p)} className="block w-full border-b border-navy-50 px-3 py-2 text-start text-sm last:border-0 hover:bg-teal-50">
                      <span className="font-medium text-navy-900">{p.name}</span>
                      <span className="text-xs text-navy-400"> · {p.area ?? ""}{p.specialty ? ` · ${L(SPECIALTY_LABELS[p.specialty])}` : ""}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </Field>

        {/* Predefined services (per selected provider) */}
        {provider && (
          <Field label={`${t("portal.selectServices")} — ${provider.name}`} note={t("portal.requestedServicesNote")}>
            <div className="flex flex-wrap gap-1.5">
              {catalog.map((s) => {
                const on = selectedServices.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleService(s)} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-teal-500 bg-teal-500 text-white" : "border-navy-200 text-navy-700 hover:bg-navy-50"}`}>
                    {on ? "✓ " : "+ "}{s}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="sel" value={manualService} onChange={(e) => setManualService(e.target.value)} placeholder={t("portal.addServiceManual")} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }} />
              <button type="button" onClick={addManual} className="shrink-0 rounded-lg border border-navy-200 px-3 text-sm text-navy-800 hover:bg-navy-50">{t("portal.add")}</button>
            </div>
            {selectedServices.length > 0 && (
              <p className="mt-2 text-xs text-navy-500">{selectedServices.join("، ")}</p>
            )}
          </Field>
        )}

        <button type="submit" disabled={loading} className="w-full rounded-lg bg-teal-500 py-2.5 font-medium text-white hover:bg-teal-600 disabled:opacity-60">
          {loading ? t("portal.submitting") : t("portal.submitRequest")}
        </button>
      </form>
      <style jsx global>{`.sel{width:100%;border-radius:.5rem;border:1px solid #d4def0;padding:.5rem .75rem;font-size:.875rem;outline:none;background:#fff}.sel:focus{border-color:#14B8A6}`}</style>
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
