/**
 * In-memory webhook event log for the demo (best-effort, per instance — fine for
 * a demo). A real partner would persist these.
 */

import { randomUUID } from "node:crypto";

export interface DemoEvent {
  id: string;
  at: string;
  event: string;
  requestId: string | null;
  verified: boolean;
  data?: unknown;
}

const events: DemoEvent[] = [];

export function recordEvent(e: Omit<DemoEvent, "id" | "at">): void {
  events.unshift({ ...e, id: randomUUID(), at: new Date().toISOString() });
  if (events.length > 50) events.length = 50;
}

export function recentEvents(): DemoEvent[] {
  return events.slice(0, 50);
}
