"use client";

import Link from "next/link";
import { useI18n, LanguageToggle } from "@/components/LocaleProvider";

export default function Home() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-block rounded bg-teal-500 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          HealthPay
        </span>
        <LanguageToggle className="text-navy-700" />
      </div>
      <h1 className="mt-4 text-4xl font-bold text-navy-900">{t("landing.title")}</h1>
      <p className="mt-4 text-lg text-navy-800">{t("landing.desc")}</p>
      <p className="mt-4 rounded-lg border border-gold-500/40 bg-gold-400/10 p-4 text-sm text-navy-800">
        {t("notInsurance")}
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href="/portal"
          className="rounded-lg bg-teal-500 px-5 py-2.5 font-medium text-white hover:bg-teal-600"
        >
          {t("portal.brand")}
        </Link>
        <Link
          href="/ops"
          className="rounded-lg bg-navy-900 px-5 py-2.5 font-medium text-white hover:bg-navy-800"
        >
          {t("landing.opsDashboard")}
        </Link>
        <a
          href="https://github.com/HealthFlowEgy/HealthPay-Medical-Discount-card"
          className="rounded-lg border border-navy-900/20 px-5 py-2.5 font-medium text-navy-900 hover:bg-white"
        >
          {t("landing.docs")}
        </a>
      </div>
    </main>
  );
}
