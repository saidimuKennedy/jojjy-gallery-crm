import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type Client = Prisma.TransactionClient;

export interface AuditEntry {
  actorCrmUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  reason?: string | null;
}

/**
 * Append-only audit record for high-impact actions. Deliberately allowed to
 * throw: when called inside a transaction it rolls the action back rather than
 * letting a sensitive change happen unaudited.
 */
export async function recordAudit(
  tx: Client | typeof prisma,
  entry: AuditEntry
): Promise<void> {
  await tx.crmAuditLog.create({
    data: {
      actorCrmUserId: entry.actorCrmUserId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
      reason: entry.reason ?? null,
    },
  });
}
