"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n, LanguageToggle } from "@/components/LocaleProvider";

export default function OpsLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ops/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Login failed");
      }
      router.push("/ops");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-navy-100 bg-white p-8 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <span className="inline-block rounded bg-teal-500 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            HealthPay
          </span>
          <LanguageToggle className="text-navy-700" />
        </div>
        <h1 className="mt-3 text-2xl font-bold text-navy-900">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-navy-700">{t("login.subtitle")}</p>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="mt-5 block text-sm font-medium text-navy-800">{t("login.email")}</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-navy-100 px-3 py-2 outline-none focus:border-teal-500"
          placeholder="admin@healthpay.test"
        />

        <label className="mt-4 block text-sm font-medium text-navy-800">{t("login.password")}</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-navy-100 px-3 py-2 outline-none focus:border-teal-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-navy-900 py-2.5 font-medium text-white hover:bg-navy-800 disabled:opacity-60"
        >
          {loading ? t("login.submitting") : t("login.submit")}
        </button>
      </form>
    </main>
  );
}
