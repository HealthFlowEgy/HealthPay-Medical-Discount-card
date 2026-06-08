"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, LanguageToggle } from "@/components/LocaleProvider";

export default function OpsRegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", signupCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ops/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Sign-up failed");
      router.push("/ops");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-navy-100 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="rounded bg-teal-500 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">HealthPay</span>
          <LanguageToggle className="text-navy-700" />
        </div>
        <h1 className="mt-3 text-2xl font-bold text-navy-900">{t("ops.staffSignup")}</h1>
        <p className="mt-1 text-xs text-gold-500">{t("ops.signupNote")}</p>
        {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <Field label={t("ops.name")}>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="inp" />
        </Field>
        <Field label={t("login.email")}>
          <input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} className="inp" />
        </Field>
        <Field label={t("login.password")}>
          <input type="password" required minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} className="inp" />
        </Field>
        <Field label={t("ops.signupCode")}>
          <input value={form.signupCode} onChange={(e) => set("signupCode", e.target.value)} className="inp" />
        </Field>

        <button type="submit" disabled={loading} className="mt-6 w-full rounded-lg bg-navy-900 py-2.5 font-medium text-white hover:bg-navy-800 disabled:opacity-60">
          {loading ? t("login.submitting") : t("ops.staffSignup")}
        </button>
        <Link href="/ops/login" className="mt-3 block text-center text-sm text-teal-600 hover:underline">
          {t("ops.haveOpsAccount")}
        </Link>
      </form>
      <style jsx global>{`.inp{width:100%;border-radius:.5rem;border:1px solid #d4def0;padding:.5rem .75rem;font-size:.875rem;outline:none}.inp:focus{border-color:#14B8A6}`}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block text-sm">
      <span className="mb-1 block font-medium text-navy-800">{label}</span>
      {children}
    </label>
  );
}
