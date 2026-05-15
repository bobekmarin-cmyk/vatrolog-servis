import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

function num(v: bigint | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "bigint" ? Number(v) : v;
}

export type ServicerMonthRow = { monthKey: string; label: string; count: number; days: number; avgPerDay: string };

export type ServicerLastServiceRow = {
  id: string;
  servicedAtIso: string;
  internalCode: string | null;
  manufacturerLabel: string | null;
  typeLabel: string | null;
  orderNumber: string;
  workOrderId: string;
  customerLabel: string;
};

export type ServicerDetailSnapshot = {
  servicerId: string;
  fullName: string;
  active: boolean;
  fromIso: string;
  toExclusiveIso: string;
  rangeLabel: string;
  totals: { serviced: number; internalDone: number; upPercent: number; distinctDays: number; avgPerDay: number };
  monthly: ServicerMonthRow[];
  lastServices: ServicerLastServiceRow[];
};

/**
 * Detaljna analitika jednog servisera u vremenskom rasponu [from, toExclusive).
 */
export async function getServicerDetailSnapshot(
  prisma: PrismaClient,
  companyId: string,
  servicerId: string,
  from: Date,
  toExclusive: Date,
  rangeLabel: string,
): Promise<ServicerDetailSnapshot | null> {
  const user = await prisma.user.findFirst({
    where: { id: servicerId, companyId },
    select: { id: true, fullName: true, active: true },
  });
  if (!user) return null;

  const totalsRow = await prisma.$queryRaw<
    Array<{ serviced: bigint; internal_done: bigint; days: bigint }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS serviced,
      SUM(CASE WHEN woi."internalDone" THEN 1 ELSE 0 END)::bigint AS internal_done,
      COUNT(DISTINCT DATE_TRUNC('day', woi."servicedAt" AT TIME ZONE 'UTC'))::bigint AS days
    FROM "WorkOrderItem" woi
    WHERE woi."companyId" = ${companyId}
      AND woi."servicerId" = ${servicerId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
  `);
  const serviced = num(totalsRow[0]?.serviced);
  const internalDone = num(totalsRow[0]?.internal_done);
  const days = Math.max(1, num(totalsRow[0]?.days));
  const upPercent = serviced <= 0 ? 0 : Math.round((10000 * internalDone) / serviced) / 100;

  const MONTH_NAMES = [
    "Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro",
  ];

  const byMonthRaw = await prisma.$queryRaw<Array<{ m: Date; cnt: bigint }>>(Prisma.sql`
    SELECT
      DATE_TRUNC('month', woi."servicedAt" AT TIME ZONE 'UTC')::date AS m,
      COUNT(*)::bigint AS cnt
    FROM "WorkOrderItem" woi
    WHERE woi."companyId" = ${companyId}
      AND woi."servicerId" = ${servicerId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  const dayCounts = await prisma.$queryRaw<Array<{ m: Date; dcnt: bigint }>>(Prisma.sql`
    SELECT
      DATE_TRUNC('month', woi."servicedAt" AT TIME ZONE 'UTC')::date AS m,
      COUNT(DISTINCT DATE_TRUNC('day', woi."servicedAt" AT TIME ZONE 'UTC'))::bigint AS dcnt
    FROM "WorkOrderItem" woi
    WHERE woi."companyId" = ${companyId}
      AND woi."servicerId" = ${servicerId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
    GROUP BY 1
  `);
  const daysByMonth = new Map(dayCounts.map((r) => [r.m.toISOString().slice(0, 10), num(r.dcnt)]));

  const monthly: ServicerMonthRow[] = byMonthRaw.map((r) => {
    const mk = r.m.toISOString().slice(0, 10);
    const y = r.m.getUTCFullYear();
    const mo = r.m.getUTCMonth();
    const dcnt = daysByMonth.get(mk) ?? 1;
    const c = num(r.cnt);
    return {
      monthKey: mk,
      label: `${MONTH_NAMES[mo] ?? ""} ${y}`,
      count: c,
      days: dcnt,
      avgPerDay: dcnt > 0 ? (c / dcnt).toFixed(1) : "-",
    };
  });

  const last = await prisma.workOrderItem.findMany({
    where: {
      companyId,
      servicerId,
      servicedAt: { not: null, gte: from, lt: toExclusive },
      isPlaceholder: false,
      extinguisherId: { not: null },
    },
    orderBy: { servicedAt: "desc" },
    take: 25,
    select: {
      id: true,
      servicedAt: true,
      extinguisher: {
        select: {
          internalCode: true,
          manufacturer: { select: { name: true, displayName: true } },
          type: { select: { code: true, agent: true, construction: true } },
        },
      },
      workOrder: { select: { id: true, orderNumber: true, customer: true } },
    },
  });

  const lastServices: ServicerLastServiceRow[] = last.map((item) => ({
    id: item.id,
    servicedAtIso: item.servicedAt!.toISOString(),
    internalCode: item.extinguisher?.internalCode ?? null,
    manufacturerLabel: item.extinguisher
      ? displayManufacturer(item.extinguisher.manufacturer)
      : null,
    typeLabel: item.extinguisher?.type ? formatExtinguisherTypeName(item.extinguisher.type) : null,
    orderNumber: item.workOrder.orderNumber,
    workOrderId: item.workOrder.id,
    customerLabel: customerDisplayName(item.workOrder.customer),
  }));

  return {
    servicerId: user.id,
    fullName: user.fullName,
    active: user.active,
    fromIso: from.toISOString(),
    toExclusiveIso: toExclusive.toISOString(),
    rangeLabel,
    totals: {
      serviced,
      internalDone,
      upPercent,
      distinctDays: num(totalsRow[0]?.days),
      avgPerDay: Math.round((100 * serviced) / days) / 100,
    },
    monthly,
    lastServices,
  };
}
