import "server-only";
import type { Prisma } from "@prisma/client";
import { rawPrisma } from "@/server/db/client";

/**
 * Every sensitive action (per spec section 27) writes an audit row.
 * This is a thin, unopinionated helper so call sites stay one line —
 * `recordAudit(ctx, "SALE_VOID", "Sale", sale.id, { reason })`.
 */
export async function recordAudit(params: {
  organizationId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  await rawPrisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress ?? null,
    },
  });
}
