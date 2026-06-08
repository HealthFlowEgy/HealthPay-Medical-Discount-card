"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROVIDER_TYPES,
  PROVIDER_TYPE_LABELS,
  SPECIALTIES,
  SPECIALTY_LABELS,
  GOVERNORATES,
  GOVERNORATE_LABELS,
} from "@healthpay/shared";

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState({
    providerType: "labs",
    specialty: "",
    governorate: "Cairo",
    area: "Nasr City",
    nationalId: "30101010123451",
    mobile: "+201001234567",
    memberNameEn: "Ahmed Mansour",
    memberNameAr: "أحمد منصور",
    company: "MediBook Member",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to request pricing");
      router.push(`/orders/${data.id}?t=${encodeURIComponent(data.token)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="text-2xl font-bold text-ink">Get medical discount pricing</h1>
      <p className="mt-1 text-ink-600">
        MediBook requests pricing from HealthPay on your behalf. Fill in the details and we&apos;ll
        send you discounted options to choose from.
      </p>

      <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
        <Field label="Service / provider type">
          <select className="input" value={form.providerType} onChange={(e) => set("providerType", e.target.value)}>
            {PROVIDER_TYPES.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_TYPE_LABELS[p].en} — {PROVIDER_TYPE_LABELS[p].ar}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Specialty (optional)">
          <select className="input" value={form.specialty} onChange={(e) => set("specialty", e.target.value)}>
            <option value="">— Any —</option>
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {SPECIALTY_LABELS[s].en} — {SPECIALTY_LABELS[s].ar}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Governorate">
          <select className="input" value={form.governorate} onChange={(e) => set("governorate", e.target.value)}>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {GOVERNORATE_LABELS[g].en} — {GOVERNORATE_LABELS[g].ar}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Area / district">
          <input className="input" value={form.area} onChange={(e) => set("area", e.target.value)} />
        </Field>
        <Field label="National ID">
          <input className="input" value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} />
        </Field>
        <Field label="Mobile">
          <input className="input" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
        </Field>
        <Field label="Name (English)">
          <input className="input" value={form.memberNameEn} onChange={(e) => set("memberNameEn", e.target.value)} />
        </Field>
        <Field label="Name (Arabic)">
          <input className="input" dir="rtl" value={form.memberNameAr} onChange={(e) => set("memberNameAr", e.target.value)} />
        </Field>

        {error && <div className="sm:col-span-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? "Requesting pricing…" : "Request pricing from HealthPay"}
          </button>
        </div>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: #4f46e5;
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}
