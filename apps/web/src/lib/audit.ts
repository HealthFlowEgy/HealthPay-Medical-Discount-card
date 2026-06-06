/** Audit logging. Every state transition and every PII reveal must be recorded. */

import type { Database } from "@healthpay/db";
import { auditLog } from "@healthpay/db/schema";

export type ActorType = "partner" | "ops" | "user" | "system";

export interface AuditInput {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function writeAudit(db: Database, input: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    requestId: input.requestId ?? null,
    metadata: input.metadata ?? null,
  });
}
