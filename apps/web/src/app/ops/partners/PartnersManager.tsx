"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n, LanguageToggle } from "@/components/LocaleProvider";

interface Partner {
  id: string;
  name: string;
  status: "active" | "suspended";
  apiKeyPrefix: string | null;
  webhookUrl: string | null;
  createdAt: string;
}

interface Credentials {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
}

export default function PartnersManager() {
  const { t } = useI18n();
  const [items, setItems] = useState<Partner[]>([]);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<(Credentials & { name?: string }) | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/ops/partners", { cache: "no-store" });
    if (res.ok) setItems((await res.json()).items ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/v1/ops/partners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, webhookUrl: webhookUrl || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error?.message ?? "Failed");
      return;
    }
    setName("");
    setWebhookUrl("");
    setCreds(data.partner);
    void load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/v1/ops/partners/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    void load();
  }

  async function rotate(p: Partner) {
    if (!window.confirm(t("partners.rotateConfirm"))) return;
    const res = await fetch(`/api/v1/ops/partners/${p.id}/rotate`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setCreds({ ...data.credentials, name: p.name });
      void load();
    }
  }

  function editWebhook(p: Partner) {
    const next = window.prompt(t("partners.webhook"), p.webhookUrl ?? "");
    if (next === null) return;
    void patch(p.id, { webhookUrl: next.trim() || null });
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-navy-100 bg-navy-900 px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <span className="rounded bg-teal-500 px-2 py-1 text-xs font-semibold uppercase tracking-wide">HealthPay</span>
          <h1 className="text-lg font-semibold">{t("partners.title")}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <LanguageToggle className="text-white" />
          <Link href="/ops" className="rounded bg-navy-800 px-3 py-1.5 hover:bg-navy-700">
            {t("ops.title")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-6">
        <p className="mb-4 text-sm text-navy-500">{t("partners.subtitle")}</p>

        <form onSubmit={create} className="mb-5 grid grid-cols-1 gap-2 rounded-xl border border-navy-100 bg-white p-4 sm:grid-cols-[1fr_1.4fr_auto]">
          <input required placeholder={t("partners.name")} value={name} onChange={(e) => setName(e.target.value)} className="inp" />
          <input type="url" placeholder={`${t("partners.webhook")} (https://…)`} value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="inp" />
          <button className="rounded-lg bg-teal-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-600">{t("partners.create")}</button>
          {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-3">{error}</div>}
        </form>

        <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
          <table className="w-full text-start text-sm">
            <thead className="bg-navy-50 text-xs uppercase text-navy-700">
              <tr>
                <th className="px-4 py-2 text-start">{t("partners.name")}</th>
                <th className="px-4 py-2 text-start">{t("partners.apiKey")}</th>
                <th className="px-4 py-2 text-start">{t("partners.status")}</th>
                <th className="px-4 py-2 text-start">{t("partners.webhook")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-navy-500">{t("partners.none")}</td></tr>
              )}
              {items.map((p) => (
                <tr key={p.id} className="border-t border-navy-50 align-top">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-navy-900">{p.name}</div>
                    <div className="text-xs text-navy-400">{new Date(p.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-navy-600">{p.apiKeyPrefix ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={p.status === "active" ? "text-emerald-600" : "text-red-600"}>
                      {p.status === "active" ? t("partners.active") : t("partners.suspended")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 max-w-[12rem] truncate text-xs text-navy-500" title={p.webhookUrl ?? ""}>
                    {p.webhookUrl ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button onClick={() => editWebhook(p)} className="rounded border border-navy-200 px-2 py-1 text-xs hover:bg-navy-50">
                        {t("partners.editWebhook")}
                      </button>
                      <button onClick={() => rotate(p)} className="rounded border border-gold-500 px-2 py-1 text-xs text-gold-600 hover:bg-gold-400/10">
                        {t("partners.rotate")}
                      </button>
                      <button
                        onClick={() => patch(p.id, { status: p.status === "active" ? "suspended" : "active" })}
                        className="rounded border border-navy-200 px-2 py-1 text-xs hover:bg-navy-50"
                      >
                        {p.status === "active" ? t("partners.suspend") : t("partners.activate")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
      <style jsx global>{`.inp{border-radius:.5rem;border:1px solid #d4def0;padding:.45rem .6rem;font-size:.85rem;outline:none}.inp:focus{border-color:#14B8A6}`}</style>
    </div>
  );
}

function CredentialsModal({
  creds,
  onClose,
}: {
  creds: Credentials & { name?: string };
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-navy-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-navy-900">
          ⚠ {t("partners.secretsTitle")}{creds.name ? ` · ${creds.name}` : ""}
        </h2>
        <p className="mt-1 text-xs text-gold-600">{t("partners.secretsNote")}</p>
        <div className="mt-4 space-y-3">
          <SecretRow label={t("partners.apiKey")} value={creds.apiKey} />
          <SecretRow label={t("partners.apiSecret")} value={creds.apiSecret} />
          <SecretRow label={t("partners.webhookSecret")} value={creds.webhookSecret} />
        </div>
        <div className="mt-5 text-end">
          <button onClick={onClose} className="rounded-lg bg-navy-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-navy-800">
            {t("partners.done")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div>
      <p className="text-xs font-medium text-navy-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="grow truncate rounded bg-navy-50 px-2 py-1.5 font-mono text-xs text-navy-900">{value}</code>
        <button onClick={copy} className="shrink-0 rounded border border-navy-200 px-2 py-1.5 text-xs hover:bg-navy-50">
          {copied ? t("partners.copied") : t("partners.copy")}
        </button>
      </div>
    </div>
  );
}
