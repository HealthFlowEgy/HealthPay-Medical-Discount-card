/**
 * Server-side transition orchestrator.
 *
 * This is the ONLY place request status changes. It wraps the pure
 * `assertTransition` from @healthpay/shared with the mandated side effects:
 *   1. validate the transition (throws InvalidTransitionError if illegal)
 *   2. persist the new status
 *   3. write an audit_log row
 *   4. enqueue the partner webhook (for transitions that map to an event)
 *   5. publish an ops SSE event
 */

import { eq } from "drizzle-orm";
import { assertTransition, type RequestStatus } from "@healthpay/shared";
import type { Database, ServiceRequest } from "@healthpay/db";
import { serviceRequests } from "@healthpay/db/schema";
import { writeAudit, type ActorType } from "./audit.js";
import { enqueueWebhook } from "./webhooks.js";
import { publishOpsEvent, type OpsEvent } from "./events.js";
import { serializeRequestForPartner } from "./serializers.js";

export interface TransitionContext {
  actorType: ActorType;
  actorId?: string | null;
  /** Extra audit metadata (e.g. selected option id). */
  metadata?: Record<string, unknown>;
  /** Webhook payload override; defaults to the partner request view. */
  webhookPayload?: unknown;
}

const EVENT_TO_OPS_TYPE: Record<string, OpsEvent["type"]> = {
  "request.quoted": "request.quoted",
  "request.confirmed": "request.confirmed",
  "request.expired": "request.expired",
  "request.cancelled": "request.cancelled",
};

/**
 * Transition `request` to `to`, returning the updated row. Must be invoked with
 * the current request row (its `.status` is the `from` state).
 */
export async function transitionRequest(
  db: Database,
  request: ServiceRequest,
  to: RequestStatus,
  ctx: TransitionContext,
): Promise<ServiceRequest> {
  const result = assertTransition(request.status as RequestStatus, to);

  const [updated] = await db
    .update(serviceRequests)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(serviceRequests.id, request.id))
    .returning();
  if (!updated) throw new Error("Failed to persist transition.");

  await writeAudit(db, {
    actorType: ctx.actorType,
    actorId: ctx.actorId,
    action: `request.transition.${result.from}_to_${result.to}`,
    requestId: request.id,
    metadata: { from: result.from, to: result.to, ...ctx.metadata },
  });

  // Webhooks only apply to partner-originated requests; portal (client) requests
  // have no partner endpoint.
  if (result.event && updated.partnerId) {
    await enqueueWebhook(db, {
      partnerId: updated.partnerId,
      requestId: updated.id,
      event: result.event,
      payload: ctx.webhookPayload ?? serializeRequestForPartner(updated),
    });
  }

  const opsType: OpsEvent["type"] = result.event
    ? EVENT_TO_OPS_TYPE[result.event] ?? "request.updated"
    : "request.updated";
  publishOpsEvent({
    type: opsType,
    requestId: updated.id,
    status: updated.status,
    at: new Date().toISOString(),
  });

  return updated;
}
