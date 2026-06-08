"use client";

import { useCallback, useEffect, useState } from "react";

const HEALTHPAY_URL = process.env.NEXT_PUBLIC_HEALTHPAY_URL ?? "";

interface Option {
  id: string;
  providerName: string;
  providerAddress: string | null;
  serviceDescription: string;
  listPrice: number;
  discountedPrice: number;
  discountPct: number;
  currency: string;
}
interface Order {
  id: string;
  status: string;
  providerType: string | null;
  governorate: string;
  area: string | null;
  mobile: string;
  partnerReference: string | null;
  options?: Option[];
  selectedOptionId?: string | null;
  error?: string;
}
interface DemoEvent {
  id: string;
  at: string;
  event: string;
  verified: boolean;
}

const STEPS = [
  { key: "requested", label: "Requested" },
  { key: "quoted", label: "Priced by HealthPay" },
  { key: "confirmed", label: "Confirmed" },
];

export default function OrderPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  const token = searchParams.t ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    const [o, e] = await Promise.all([
      fetch(`/api/orders/${params.id}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/events`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ events: [] })),
    ]);
    setOrder(o);
    setEvents(e.events ?? []);
  }, [params.id]);

  useEffect(() => {
    void poll();
    const t = setInterval(poll, 3500);
    return () => clearInterval(t);
  }, [poll]);

  async function confirm(optionId: string) {
    setConfirming(optionId);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${params.id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not confirm");
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setConfirming(null);
      void poll();
    }
  }

  if (!order) {
    return <main className="mx-auto max-w-4xl px-5 py-10 text-ink-600">Loading…</main>;
  }

  const stepIndex =
    order.status === "confirmed" ? 2 : order.status === "quoted" ? 1 : 0;
  const isConfirmed = order.status === "confirmed";
  const isPending = order.status === "pending_quote";
  const isQuoted = order.status === "quoted";

  return (
    <main className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-5 py-10 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <p className="text-xs text-ink-400">Order {order.partnerReference ?? order.id}</p>
        <h1 className="text-2xl font-bold text-ink">Your medical pricing</h1>

        {/* Timeline */}
        <ol className="mt-5 flex items-center">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${
                    i <= stepIndex ? "bg-brand text-white" : "bg-slate-200 text-ink-400"
                  }`}
                >
                  {i < stepIndex || isConfirmed && i <= stepIndex ? "✓" : i + 1}
                </span>
                <span className="mt-1 w-24 text-center text-xs text-ink-600">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-0.5 flex-1 ${i < stepIndex ? "bg-brand" : "bg-slate-200"}`} />
              )}
            </li>
          ))}
        </ol>

        {error && <div className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {isPending && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <p className="font-medium text-ink">⏳ Waiting for HealthPay to attach pricing…</p>
            <p className="mt-1 text-sm text-ink-600">
              HealthPay operations staff are matching providers and adding discount options for your{" "}
              {order.providerType?.replace(/_/g, " ")} request in {order.governorate}
              {order.area ? ` · ${order.area}` : ""}. This page updates automatically.
            </p>
            <p className="mt-3 text-xs text-ink-400">
              An SMS with a secure quote link was also sent to {order.mobile}.
            </p>
          </div>
        )}

        {(isQuoted || isConfirmed) && order.options && (
          <div className="mt-6 space-y-3">
            {isConfirmed && (
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                ✓ Confirmed! Your selection has been registered with HealthPay.
              </div>
            )}
            {order.options.map((o) => {
              const chosen = order.selectedOptionId === o.id;
              return (
                <div
                  key={o.id}
                  className={`rounded-xl border-2 p-4 ${
                    chosen ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
                  } ${isConfirmed && !chosen ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-ink">{o.providerName}</p>
                      <p className="text-sm text-ink-600">{o.serviceDescription}</p>
                      {o.providerAddress && <p className="mt-1 text-xs text-ink-400">{o.providerAddress}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-ink-400 line-through">
                        {o.listPrice} {o.currency}
                      </p>
                      <p className="text-lg font-bold text-brand">
                        {o.discountedPrice} {o.currency}
                      </p>
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-600">
                        Save {o.discountPct}%
                      </span>
                    </div>
                  </div>
                  {isQuoted && (
                    <button
                      onClick={() => confirm(o.id)}
                      disabled={confirming !== null}
                      className="mt-3 rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                    >
                      {confirming === o.id ? "Confirming…" : "Choose this option"}
                    </button>
                  )}
                  {chosen && <p className="mt-2 text-xs font-medium text-emerald-700">✓ Your choice</p>}
                </div>
              );
            })}
            {isQuoted && token && HEALTHPAY_URL && (
              <a
                href={`${HEALTHPAY_URL}/quote/${token}`}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-sm text-brand underline"
              >
                …or confirm on the secure HealthPay quote page ↗
              </a>
            )}
          </div>
        )}

        {(order.status === "expired" || order.status === "cancelled") && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-ink-600">
            This request is {order.status}.
          </div>
        )}
      </div>

      {/* Live events panel */}
      <aside className="lg:col-span-1">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-ink">Webhook events</h2>
          <p className="mt-0.5 text-xs text-ink-400">Signed events HealthPay pushed to MediBook.</p>
          <ul className="mt-3 space-y-2">
            {events.length === 0 && <li className="text-xs text-ink-400">No events yet.</li>}
            {events.map((e) => (
              <li key={e.id} className="rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{e.event}</span>
                  <span className={e.verified ? "text-emerald-600" : "text-red-600"}>
                    {e.verified ? "✓ verified" : "✗ unverified"}
                  </span>
                </div>
                <span className="text-ink-400">{new Date(e.at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-xs text-ink-400">
          Status is polled via the HealthPay SDK; events arrive via signed webhooks.
        </p>
      </aside>
    </main>
  );
}
