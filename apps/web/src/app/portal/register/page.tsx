"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LocaleProvider";
import PortalHeader from "../PortalHeader";

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState(true);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("whatsapp", whatsapp ? "true" : "false");
      const res = await fetch("/api/v1/portal/register", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Registration failed");
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
      <main className="mx-auto max-w-lg px-5 py-8">
        <h1 className="text-2xl font-bold text-navy-900">{t("portal.register")}</h1>
        <form onSubmit={submit} className="mt-5 space-y-4 rounded-xl border border-navy-100 bg-white p-6">
          {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <L label={t("portal.fullName")} note={t("portal.fullNameNote")}>
            <input name="fullName" required className="inp" />
          </L>
          <L label={t("portal.nationalId")}>
            <input name="nationalId" required inputMode="numeric" maxLength={14} className="inp" />
          </L>
          <L label={t("portal.mobile")} note={t("portal.mobileNote")}>
            <input name="mobile" required placeholder="+201XXXXXXXXX" className="inp" dir="ltr" />
          </L>
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} />
            {t("portal.whatsapp")}
          </label>
          <L label={t("portal.password")}>
            <input name="password" type="password" required minLength={8} className="inp" />
          </L>
          <L label={t("portal.idCard")} note={t("portal.idCardNote")}>
            <input name="idCard" type="file" accept="image/*,application/pdf" required className="block w-full text-sm" />
          </L>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-navy-900 py-2.5 font-medium text-white hover:bg-navy-800 disabled:opacity-60"
          >
            {loading ? t("portal.submitting") : t("portal.register")}
          </button>
          <Link href="/portal/login" className="block text-center text-sm text-teal-600 hover:underline">
            {t("portal.haveAccount")}
          </Link>
        </form>
      </main>
      <style jsx global>{`
        .inp { width:100%; border-radius:.5rem; border:1px solid #d4def0; padding:.5rem .75rem; font-size:.875rem; outline:none; }
        .inp:focus { border-color:#14B8A6; }
      `}</style>
    </>
  );
}

function L({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-navy-800">{label}</span>
      {children}
      {note && <span className="mt-1 block text-xs text-gold-500">{note}</span>}
    </label>
  );
}
