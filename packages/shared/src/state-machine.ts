/**
 * Service-request lifecycle state machine.
 *
 *   pending_quote ──▶ quoted        (ops attaches ≥1 pricing option)
 *   pending_quote ──▶ cancelled     (partner/user cancels)
 *   quoted        ──▶ confirmed     (user selects exactly one option)
 *   quoted        ──▶ expired       (quote_expires_at passes, no selection)
 *   quoted        ──▶ cancelled
 *   confirmed     ──▶ (terminal)
 *   expired       ──▶ (terminal)
 *   cancelled     ──▶ (terminal)
 *
 * This module is intentionally PURE: it knows only about legal transitions.
 * Side effects required on every transition — writing an audit_log row and
 * emitting a webhook + SSE event — are the caller's responsibility and are
 * wired in the API layer. `assertTransition` is the single choke point every
 * status change must pass through.
 */

import { InvalidTransitionError } from "./errors.js";

export const REQUEST_STATUSES = [
  "pending_quote",
  "quoted",
  "confirmed",
  "expired",
  "cancelled",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Allowed target states from each state. Terminal states map to []. */
export const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  pending_quote: ["quoted", "cancelled"],
  quoted: ["confirmed", "expired", "cancelled"],
  confirmed: [],
  expired: [],
  cancelled: [],
};

/** Maps each transition to the webhook event partners receive. */
export const TRANSITION_EVENTS: Partial<
  Record<RequestStatus, Partial<Record<RequestStatus, string>>>
> = {
  pending_quote: {
    quoted: "request.quoted",
    cancelled: "request.cancelled",
  },
  quoted: {
    confirmed: "request.confirmed",
    expired: "request.expired",
    cancelled: "request.cancelled",
  },
};

export function isRequestStatus(value: unknown): value is RequestStatus {
  return (
    typeof value === "string" && (REQUEST_STATUSES as readonly string[]).includes(value)
  );
}

export function isTerminal(status: RequestStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Resolve the webhook event name for a legal transition, if any. */
export function eventForTransition(
  from: RequestStatus,
  to: RequestStatus,
): string | undefined {
  return TRANSITION_EVENTS[from]?.[to];
}

export interface TransitionResult {
  from: RequestStatus;
  to: RequestStatus;
  /** Webhook event to emit for this transition, if defined. */
  event?: string;
}

/**
 * The single choke point for status changes. Validates that `from -> to` is
 * legal and throws `InvalidTransitionError` otherwise. Returns a descriptor the
 * caller uses to persist the new status and fire side effects (audit/webhook/SSE).
 *
 * This does NOT mutate anything and performs no I/O.
 */
export function assertTransition(
  from: RequestStatus,
  to: RequestStatus,
): TransitionResult {
  if (!isRequestStatus(from) || !isRequestStatus(to)) {
    throw new InvalidTransitionError(
      `Unknown status in transition ${String(from)} -> ${String(to)}.`,
      { from, to },
    );
  }
  if (from === to) {
    throw new InvalidTransitionError(`Request is already in "${to}".`, { from, to });
  }
  if (!canTransition(from, to)) {
    const allowed = TRANSITIONS[from];
    const hint = allowed.length
      ? `Allowed: ${allowed.join(", ")}.`
      : `"${from}" is a terminal state.`;
    throw new InvalidTransitionError(
      `Illegal transition ${from} -> ${to}. ${hint}`,
      { from, to, allowed },
    );
  }
  return { from, to, event: eventForTransition(from, to) };
}
