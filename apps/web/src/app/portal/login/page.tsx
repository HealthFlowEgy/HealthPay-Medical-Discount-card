"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LocaleProvider";
import PortalHeader from "../PortalHeader";

export default function PortalLoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/portal/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nationalId, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Login failed");
      router.push("/portal");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PortalHeader />
      <main className="mx-auto max-w-sm px-5 py-10">
        <h1 className="text-2xl font-bold text-navy-900">{t("portal.login")}</h1>
        <form onSubmit={submit} className="mt-5 space-y-4 rounded-xl border border-navy-100 bg-white p-6">
          {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy-800">{t("portal.nationalId")}</span>
            <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} required className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-teal-500" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy-800">{t("portal.password")}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-teal-500" />
          </label>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-navy-900 py-2.5 font-medium text-white hover:bg-navy-800 disabled:opacity-60">
            {loading ? t("portal.submitting") : t("portal.login")}
          </button>
          <Link href="/portal/register" className="block text-center text-sm text-teal-600 hover:underline">
            {t("portal.noAccount")}
          </Link>
        </form>
      </main>
    </>
  );
}
