"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SERVICE_TYPE_LABELS,
  PROVIDER_TYPE_LABELS,
  GOVERNORATE_LABELS,
  type ProviderType,
  type Governorate,
} from "@healthpay/shared";
import { useI18n, LanguageToggle } from "@/components/LocaleProvider";

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
  providerType: ProviderType | null;
  governorate: Governorate;
  area: string | null;
  city: string | null;
  mobile: string;
  memberNameAr: string | null;
  memberNameEn: string | null;
  expiresAt: string;
  options: Option[];
  selectedOptionId: string | null;
}

export default function QuotePage({ params }: { params: { token: string } }) {
  const { t } = useI18n();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/quote/${params.token}`, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setLoadError(body?.error?.message ?? t("quote.linkUnavailable"));
      return;
    }
    const data: Quote = await res.json();
    setQuote(data);
    setSelected(data.selectedOptionId);
  }, [params.token, t]);

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
      if (!res.ok) throw new Error(body?.error?.message ?? t("quote.couldNotConfirm"));
      setQuote(body);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : t("quote.couldNotConfirm"));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-teal-500 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            HealthPay
          </span>
          <span className="text-sm text-navy-500">{t("brand.tagline")}</span>
        </div>
        <LanguageToggle className="text-navy-700" />
      </div>

      {loadError ? (
        <Card>
          <h1 className="text-xl font-semibold text-navy-900">{t("quote.linkUnavailable")}</h1>
          <p className="mt-2 text-navy-600">{loadError}</p>
        </Card>
      ) : !quote ? (
        <Card>
          <p className="text-navy-500">{t("quote.loadingPricing")}</p>
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

      <p className="mt-8 text-center text-xs text-navy-400">{t("notInsurance")}</p>
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
  const { t, L, locale } = useI18n();
  const serviceLabel = quote.providerType
    ? L(PROVIDER_TYPE_LABELS[quote.providerType])
    : L(SERVICE_TYPE_LABELS[quote.serviceType]);
  const govLabel = L(GOVERNORATE_LABELS[quote.governorate]);
  const memberName = locale === "ar" ? quote.memberNameAr : quote.memberNameEn;

  if (quote.status === "pending_quote") {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-navy-900">{t("quote.preparingTitle")}</h1>
        <p className="mt-2 text-navy-600">
          {serviceLabel} · {govLabel}
        </p>
      </Card>
    );
  }
  if (quote.status === "expired") {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-navy-900">{t("quote.expiredTitle")}</h1>
        <p className="mt-2 text-navy-600">{t("quote.expiredDesc")}</p>
      </Card>
    );
  }
  if (quote.status === "cancelled") {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-navy-900">{t("quote.cancelledTitle")}</h1>
      </Card>
    );
  }

  const isConfirmed = quote.status === "confirmed";

  return (
    <div>
      <div className="mb-4">
        {memberName && <p className="text-sm text-navy-500">{memberName}</p>}
        <h1 className="text-2xl font-bold text-navy-900">
          {isConfirmed ? t("quote.confirmedTitle") : t("quote.chooseTitle")}
        </h1>
        <p className="mt-1 text-navy-600">
          {serviceLabel} · {govLabel}
          {quote.area ? ` · ${quote.area}` : ""}
        </p>
        {!isConfirmed && (
          <p className="mt-1 text-sm text-navy-400">
            {t("quote.validUntil")} {new Date(quote.expiresAt).toLocaleString()}
          </p>
        )}
      </div>

      {isConfirmed && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {t("quote.thankYou")}
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
              className={`block w-full rounded-xl border-2 p-4 text-start transition ${
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
                <div className="text-end">
                  <p className="text-sm text-navy-400 line-through">
                    {o.listPrice} {o.currency}
                  </p>
                  <p className="text-lg font-bold text-teal-600">
                    {o.discountedPrice} {o.currency}
                  </p>
                  <span className="inline-block rounded bg-gold-400/20 px-1.5 py-0.5 text-xs font-semibold text-gold-500">
                    {t("quote.save")} {o.discountPct}%
                  </span>
                </div>
              </div>
              {o.validityNote && <p className="mt-2 text-xs text-navy-400">{o.validityNote}</p>}
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
            {confirming ? t("quote.confirming") : t("quote.confirm")}
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
