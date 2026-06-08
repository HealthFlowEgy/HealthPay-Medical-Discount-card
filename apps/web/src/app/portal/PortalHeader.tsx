"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, LanguageToggle } from "@/components/LocaleProvider";

export default function PortalHeader({ authed = false }: { authed?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();

  async function logout() {
    await fetch("/api/v1/portal/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-navy-100 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
        <Link href={authed ? "/portal" : "/"} className="flex items-center gap-2">
          <span className="rounded bg-teal-500 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            HealthPay
          </span>
          <span className="text-sm font-semibold text-navy-900">{t("portal.brand")}</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <LanguageToggle className="text-navy-700" />
          {authed && (
            <>
              <Link href="/portal" className="text-navy-700 hover:text-navy-900">
                {t("portal.myRequests")}
              </Link>
              <button onClick={logout} className="rounded bg-navy-900 px-3 py-1.5 text-white hover:bg-navy-800">
                {t("portal.logout")}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
