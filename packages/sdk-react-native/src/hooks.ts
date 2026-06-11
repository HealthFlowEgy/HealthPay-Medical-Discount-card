/** React hook driving the quote lifecycle. UI-framework agnostic (no RN imports). */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HealthPayQuoteClient, type QuoteClientOptions } from "./client";
import { HealthPayError } from "./errors";
import type { Quote } from "./types";

export type FlowPhase = "loading" | "pending" | "quoted" | "confirming" | "confirmed" | "terminal" | "error";

export interface UseQuoteFlow {
  quote: Quote | null;
  phase: FlowPhase;
  error: HealthPayError | null;
  /** The option the member has tapped (not yet confirmed). */
  selectedOptionId: string | null;
  select: (optionId: string) => void;
  confirm: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseQuoteFlowOptions extends QuoteClientOptions {
  intervalMs?: number;
  onConfirmed?: (quote: Quote) => void;
  onError?: (err: HealthPayError) => void;
}

function phaseOf(q: Quote | null): FlowPhase {
  if (!q) return "loading";
  switch (q.status) {
    case "pending_quote":
      return "pending";
    case "quoted":
      return "quoted";
    case "confirmed":
    case "completed":
      return "confirmed";
    case "expired":
    case "cancelled":
      return "terminal";
    default:
      return "pending";
  }
}

export function useQuoteFlow(opts: UseQuoteFlowOptions): UseQuoteFlow {
  const { baseUrl, token, fetch: fetchImpl, timeoutMs, intervalMs, onConfirmed, onError } = opts;

  const client = useMemo(
    () => new HealthPayQuoteClient({ baseUrl, token, fetch: fetchImpl, timeoutMs }),
    [baseUrl, token, fetchImpl, timeoutMs],
  );

  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<HealthPayError | null>(null);
  const [selectedOptionId, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmedFired = useRef(false);

  const handleError = useCallback(
    (err: unknown) => {
      const e = err instanceof HealthPayError ? err : new HealthPayError("unknown", String(err));
      setError(e);
      onError?.(e);
    },
    [onError],
  );

  // Adopt a freshly-fetched quote, defaulting the selection and firing onConfirmed once.
  const adopt = useCallback(
    (q: Quote) => {
      setError(null);
      setQuote(q);
      setSelected((prev) => prev ?? q.selectedOptionId ?? q.options[0]?.id ?? null);
      if ((q.status === "confirmed" || q.status === "completed") && !confirmedFired.current) {
        confirmedFired.current = true;
        onConfirmed?.(q);
      }
    },
    [onConfirmed],
  );

  // Poll until terminal; re-subscribes if the client (token/baseUrl) changes.
  useEffect(() => {
    confirmedFired.current = false;
    const stop = client.poll(adopt, { intervalMs, onError: handleError });
    return stop;
  }, [client, adopt, intervalMs, handleError]);

  const refresh = useCallback(async () => {
    try {
      adopt(await client.get());
    } catch (err) {
      handleError(err);
    }
  }, [client, adopt, handleError]);

  const confirm = useCallback(async () => {
    if (!selectedOptionId) return;
    setConfirming(true);
    try {
      adopt(await client.confirm(selectedOptionId));
    } catch (err) {
      handleError(err);
    } finally {
      setConfirming(false);
    }
  }, [client, selectedOptionId, adopt, handleError]);

  const phase: FlowPhase = error && !quote ? "error" : confirming ? "confirming" : phaseOf(quote);

  return {
    quote,
    phase,
    error,
    selectedOptionId,
    select: setSelected,
    confirm,
    refresh,
  };
}
