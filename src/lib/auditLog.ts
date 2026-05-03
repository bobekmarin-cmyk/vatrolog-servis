import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export type AuditActorType = "ACCOUNT_USER" | "PLATFORM_USER" | "SERVICER" | "SYSTEM" | "CUSTOMER_PORTAL";

export type LogAuditInput = {
  companyId?: string | null;
  actorId?: string | null;
  actorType: AuditActorType;
  action: string; // npr. "customer.create", "workOrder.complete"
  entity?: string | null; // "Customer", "WorkOrder"
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Zapiši audit event. Nikad ne baca - ako audit log ne uspije, ne ruši
 * korisnikovu radnju, samo logira grešku u strukturirani logger.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: input.companyId ?? null,
        actorId: input.actorId ?? null,
        actorType: input.actorType,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        meta: input.meta ? (input.meta as object) : undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    logError("audit_log_write_failed", err, { action: input.action, entity: input.entity });
  }
}

/**
 * Izvuče IP iz requesta respektirajući X-Forwarded-For.
 */
export function extractAuditMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}
