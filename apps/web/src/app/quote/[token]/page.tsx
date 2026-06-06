"use client";

import { useCallback, useEffect, useState } from "react";
import { SERVICE_TYPE_LABELS } from "@healthpay/shared";

interface Option {
  id: string;
  providerName: string;
  providerAddress: string | null;
  serviceDescription: string;
  listPrice: number;
  discountedPrice: number;
  discountPct: number;
  currency: string;
  validityNote: string | null;
}

interface Quote {
  id: string;
  status: string;
  serviceType: keyof typeof SERVICE_TYPE_LABELS;
  governorate: string;
  city: string | null;
  mobile: string;
  expiresAt: string;
  options: Option[];
  selectedOptionId: string | null;
}

export default function QuotePage({ params }: { params: { token: string } }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/quote/${params.token}`, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setLoadError(body?.error?.message ?? "This quote link is invalid.");
      return;
    }
    const data: Quote = await res.json();
    setQuote(data);
    setSelected(data.selectedOptionId);
  }, [params.token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm() {
    if (!selected) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/v1/quote/${params.token}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionId: selected }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not confirm your selection.");
      setQuote(body);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Could not confirm.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="rounded bg-teal-500 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          HealthPay
        </span>
        <span className="text-sm text-navy-500">Medical discount pricing</span>
      </div>

      {loadError ? (
        <Card>
          <h1 className="text-xl font-semibold text-navy-900">Link not available</h1>
          <p className="mt-2 text-navy-600">{loadError}</p>
        </Card>
      ) : !quote ? (
        <Card>
          <p className="text-navy-500">Loading your pricing…</p>
        </Card>
      ) : (
        <QuoteBody
          quote={quote}
          selected={selected}
          setSelected={setSelected}
          confirm={confirm}
          confirming={confirming}
          confirmError={confirmError}
        />
      )}

      <p className="mt-8 text-center text-xs text-navy-400">
        HealthPay is a medical discount card (15%–70% off services). It is not insurance.
      </p>
    </main>
  );
}

function QuoteBody({
  quote,
  selected,
  setSelected,
  confirm,
  confirming,
  confirmError,
}: {
  quote: Quote;
  selected: string | null;
  setSelected: (id: string) => void;
  confirm: () => void;
  confirming: boolean;
  confirmError: string | null;
}) {
  const serviceLabel = SERVICE_TYPE_LABELS[quote.serviceType]?.en ?? quote.serviceType;

  if (quote.status === "pending_quote") {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-navy-900">Your pricing is being prepared</h1>
        <p className="mt-2 text-navy-600">
          Our team is gathering discount options for your {serviceLabel.toLowerCase()} in{" "}
          {quote.governorate}. You&apos;ll receive an SMS as soon as they&apos;re ready.
        </p>
      </Card>
    );
  }

  if (quote.status === "expired") {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-navy-900">This quote has expired</h1>
        <p className="mt-2 text-navy-600">
          Please submit a new request through your provider to receive fresh pricing.
        </p>
      </Card>
    );
  }

  if (quote.status === "cancelled") {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-navy-900">This request was cancelled</h1>
      </Card>
    );
  }

  const isConfirmed = quote.status === "confirmed";

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-navy-900">
          {isConfirmed ? "Your choice is confirmed" : "Choose your pricing option"}
        </h1>
        <p className="mt-1 text-navy-600">
          {serviceLabel} · {quote.governorate}
          {quote.city ? ` · ${quote.city}` : ""}
        </p>
        {!isConfirmed && (
          <p className="mt-1 text-sm text-navy-400">
            Valid until {new Date(quote.expiresAt).toLocaleString()}
          </p>
        )}
      </div>

      {isConfirmed && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          ✓ Thank you. Your selection has been sent to your provider.
        </div>
      )}

      <div className="space-y-3">
        {quote.options.map((o) => {
          const isSel = selected === o.id;
          const isChosen = quote.selectedOptionId === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={isConfirmed}
              onClick={() => setSelected(o.id)}
              className={`block w-full rounded-xl border-2 p-4 text-left transition ${
                isChosen
                  ? "border-emerald-500 bg-emerald-50"
                  : isSel
                    ? "border-teal-500 bg-teal-50"
                    : "border-navy-100 bg-white hover:border-teal-300"
              } ${isConfirmed && !isChosen ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-navy-900">{o.providerName}</p>
                  <p className="text-sm text-navy-600">{o.serviceDescription}</p>
                  {o.providerAddress && (
                    <p className="mt-1 text-xs text-navy-400">{o.providerAddress}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-navy-400 line-through">
                    {o.listPrice} {o.currency}
                  </p>
                  <p className="text-lg font-bold text-teal-600">
                    {o.discountedPrice} {o.currency}
                  </p>
                  <span className="inline-block rounded bg-gold-400/20 px-1.5 py-0.5 text-xs font-semibold text-gold-500">
                    Save {o.discountPct}%
                  </span>
                </div>
              </div>
              {o.validityNote && (
                <p className="mt-2 text-xs text-navy-400">{o.validityNote}</p>
              )}
            </button>
          );
        })}
      </div>

      {!isConfirmed && (
        <>
          {confirmError && (
            <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {confirmError}
            </div>
          )}
          <button
            onClick={confirm}
            disabled={!selected || confirming}
            className="mt-5 w-full rounded-xl bg-navy-900 py-3 font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {confirming ? "Confirming…" : "Confirm my selection"}
          </button>
        </>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-6 shadow-sm">{children}</div>
  );
}
