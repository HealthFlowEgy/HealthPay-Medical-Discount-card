"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n, LanguageToggle } from "@/components/LocaleProvider";

interface Employee {
  id: string;
  email: string;
  name: string;
  role: "admin" | "agent" | "super_admin";
  active: boolean;
}
interface ClientRow {
  id: string;
  fullName: string;
  nationalIdLast4: string;
  mobile: string;
  whatsapp: boolean;
  active: boolean;
  hasIdCard: boolean;
}

type ViewerRole = "agent" | "admin" | "super_admin";

export default function UsersManager({ viewerRole }: { viewerRole: ViewerRole }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"employees" | "clients">("employees");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-navy-100 bg-navy-900 px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <span className="rounded bg-teal-500 px-2 py-1 text-xs font-semibold uppercase tracking-wide">HealthPay</span>
          <h1 className="text-lg font-semibold">{t("ops.users")}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <LanguageToggle className="text-white" />
          <Link href="/ops" className="rounded bg-navy-800 px-3 py-1.5 hover:bg-navy-700">
            {t("ops.title")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-4 flex gap-2">
          {(["employees", "clients"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                tab === tabKey ? "bg-navy-900 text-white" : "border border-navy-200 text-navy-800 hover:bg-navy-50"
              }`}
            >
              {t(`ops.${tabKey}`)}
            </button>
          ))}
        </div>
        {tab === "employees" ? <Employees viewerRole={viewerRole} /> : <Clients />}
      </div>
    </div>
  );
}

function Employees({ viewerRole }: { viewerRole: ViewerRole }) {
  const { t } = useI18n();
  const isSuper = viewerRole === "super_admin";
  const [items, setItems] = useState<Employee[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "agent" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/ops/users", { cache: "no-store" });
    if (res.ok) setItems((await res.json()).items ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/v1/ops/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data?.error?.message ?? "Failed"); return; }
    setForm({ name: "", email: "", password: "", role: "agent" });
    void load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/v1/ops/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    void load();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="grid grid-cols-1 gap-2 rounded-xl border border-navy-100 bg-white p-4 sm:grid-cols-5">
        <input required placeholder={t("ops.name")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="inp" />
        <input required type="email" placeholder={t("login.email")} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="inp" />
        <input required type="password" minLength={8} placeholder={t("login.password")} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="inp" />
        <select value={form.role} disabled={!isSuper} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="inp disabled:opacity-60" title={isSuper ? undefined : t("ops.roleSuperOnly")}>
          <option value="agent">{t("ops.roleAgent")}</option>
          <option value="admin">{t("ops.roleAdmin")}</option>
        </select>
        <button className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-600">{t("ops.addEmployee")}</button>
        {error && <div className="sm:col-span-5 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </form>

      <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
        <table className="w-full text-start text-sm">
          <thead className="bg-navy-50 text-xs uppercase text-navy-700">
            <tr><th className="px-4 py-2 text-start">{t("ops.name")}</th><th className="px-4 py-2 text-start">{t("login.email")}</th><th className="px-4 py-2 text-start">{t("ops.role")}</th><th className="px-4 py-2 text-start">{t("ops.active")}</th><th /></tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t border-navy-50">
                <td className="px-4 py-2.5">{u.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.role}
                    disabled={!isSuper || u.role === "super_admin"}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                    title={isSuper ? undefined : t("ops.roleSuperOnly")}
                    className="rounded border border-navy-100 px-1.5 py-0.5 text-xs disabled:opacity-70"
                  >
                    <option value="agent">{t("ops.roleAgent")}</option>
                    <option value="admin">{t("ops.roleAdmin")}</option>
                    <option value="super_admin" disabled>{t("ops.roleSuper")}</option>
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <span className={u.active ? "text-emerald-600" : "text-red-600"}>{u.active ? t("ops.active") : t("ops.suspended")}</span>
                </td>
                <td className="px-4 py-2.5 text-end">
                  <button onClick={() => patch(u.id, { active: !u.active })} className="rounded border border-navy-200 px-2 py-1 text-xs hover:bg-navy-50">
                    {u.active ? t("ops.deactivate") : t("ops.activate")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx global>{`.inp{border-radius:.5rem;border:1px solid #d4def0;padding:.45rem .6rem;font-size:.85rem;outline:none}.inp:focus{border-color:#14B8A6}`}</style>
    </div>
  );
}

function Clients() {
  const { t } = useI18n();
  const [items, setItems] = useState<ClientRow[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/ops/clients?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    if (res.ok) setItems((await res.json()).items ?? []);
  }, [q]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(id: string, active: boolean) {
    await fetch(`/api/v1/ops/clients/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active }),
    });
    void load();
  }

  return (
    <div className="space-y-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ops.searchClients")} className="w-full rounded-lg border border-navy-100 px-3 py-1.5 text-sm" />
      <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
        <table className="w-full text-start text-sm">
          <thead className="bg-navy-50 text-xs uppercase text-navy-700">
            <tr><th className="px-4 py-2 text-start">{t("ops.col.client")}</th><th className="px-4 py-2 text-start">{t("ops.col.nationalId")}</th><th className="px-4 py-2 text-start">{t("ops.col.phone")}</th><th className="px-4 py-2 text-start">{t("ops.active")}</th><th /></tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-navy-500">{t("portal.noRequests")}</td></tr>}
            {items.map((c) => (
              <tr key={c.id} className="border-t border-navy-50">
                <td className="px-4 py-2.5">{c.fullName}</td>
                <td className="px-4 py-2.5 font-mono text-xs">••• {c.nationalIdLast4}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{c.mobile} {c.whatsapp ? "🟢" : ""}</td>
                <td className="px-4 py-2.5"><span className={c.active ? "text-emerald-600" : "text-red-600"}>{c.active ? t("ops.active") : t("ops.suspended")}</span></td>
                <td className="px-4 py-2.5 text-end">
                  <div className="flex justify-end gap-2">
                    {c.hasIdCard && (
                      <a href={`/api/v1/ops/clients/${c.id}/id-card`} target="_blank" rel="noreferrer" className="rounded border border-navy-200 px-2 py-1 text-xs hover:bg-navy-50">
                        {t("ops.viewIdCard")}
                      </a>
                    )}
                    <button onClick={() => toggle(c.id, !c.active)} className="rounded border border-navy-200 px-2 py-1 text-xs hover:bg-navy-50">
                      {c.active ? t("ops.suspend") : t("ops.reactivate")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
