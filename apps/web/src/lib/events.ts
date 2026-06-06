/**
 * In-process event bus for the ops dashboard SSE stream.
 *
 * NOTE: This is per-instance. On multi-instance deployments the dashboard also
 * polls (SSE is an enhancement, not the source of truth). To make realtime
 * global later, replace this module with a Postgres LISTEN/NOTIFY bridge or a
 * dedicated pub/sub service — call sites only use `publish`/`subscribe`.
 */

import { EventEmitter } from "node:events";

export interface OpsEvent {
  type:
    | "request.created"
    | "request.quoted"
    | "request.confirmed"
    | "request.expired"
    | "request.cancelled"
    | "request.updated";
  requestId: string;
  status: string;
  at: string; // ISO timestamp
}

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const CHANNEL = "ops";

export function publishOpsEvent(event: OpsEvent): void {
  emitter.emit(CHANNEL, event);
}

export function subscribeOpsEvents(listener: (event: OpsEvent) => void): () => void {
  emitter.on(CHANNEL, listener);
  return () => emitter.off(CHANNEL, listener);
}
