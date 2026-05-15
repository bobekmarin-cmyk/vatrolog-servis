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

export type RecentActivityEntry = {
  id: string;
  createdAt: Date;
  actorType: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  companyName: string | null;
  companyId: string | null;
  meta: Record<string, unknown> | null;
};

/**
 * Cita zadnjih N audit log entry-a sa imenom tvrtke (ako je vezana).
 * Read-only, za platform dashboard "Recent activity" feed.
 */
export async function getRecentPlatformActivity(limit = 15): Promise<RecentActivityEntry[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 50)),
    select: {
      id: true,
      createdAt: true,
      actorType: true,
      action: true,
      entity: true,
      entityId: true,
      companyId: true,
      meta: true,
      company: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    actorType: r.actorType,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    companyId: r.companyId,
    companyName: r.company?.name ?? null,
    meta: (r.meta ?? null) as Record<string, unknown> | null,
  }));
}

/**
 * Varijanta: zadnjih N audit eventa za SPECIFICNU tvrtku.
 * Koristi se na company detail "Komunikacija" tabu.
 */
export async function getCompanyRecentActivity(
  companyId: string,
  limit = 10,
): Promise<RecentActivityEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 50)),
    select: {
      id: true,
      createdAt: true,
      actorType: true,
      action: true,
      entity: true,
      entityId: true,
      companyId: true,
      meta: true,
      company: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    actorType: r.actorType,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    companyId: r.companyId,
    companyName: r.company?.name ?? null,
    meta: (r.meta ?? null) as Record<string, unknown> | null,
  }));
}
