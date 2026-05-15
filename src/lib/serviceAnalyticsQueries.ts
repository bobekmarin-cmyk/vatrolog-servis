import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

/** Kalendarski mjesec u UTC (npr. 2026-05 → 2026-05-01 00:00 UTC .. 2026-06-01 00:00 UTC). */
export function monthBoundsUtc(ym: string): { from: Date; toExclusive: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) throw new Error(`Neispravan format mjeseca: ${ym} (očekivano YYYY-MM)`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`Neispravan mjesec: ${ym}`);
  return {
    from: new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0)),
    toExclusive: new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0)),
  };
}

/** Trenutačni kalendarski mjesec u UTC (YYYY-MM). */
export function currentYmUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Pomak za N mjeseci (npr. -1 = prošli mjesec). */
export function shiftMonthYm(ym: string, deltaMonths: number): string {
  const { from } = monthBoundsUtc(ym);
  const u = Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + deltaMonths, 1);
  const d = new Date(u);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelHr(ym: string): string {
  const MONTH_NAMES = [
    "Siječanj",
    "Veljača",
    "Ožujak",
    "Travanj",
    "Svibanj",
    "Lipanj",
    "Srpanj",
    "Kolovoz",
    "Rujan",
    "Listopad",
    "Studeni",
    "Prosinac",
  ];
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return ym;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return `${MONTH_NAMES[mo - 1] ?? ""} ${y}`;
}

export type ServiceAnalyticsTotals = {
  serviced: number;
  internalDone: number;
  upPercent: number;
};

export type CountRow = { key: string; label: string; count: number; internalDone: number; upPercent: number };

export type TypeBreakdownRow = {
  typeId: string;
  label: string;
  count: number;
  internalDone: number;
  upPercent: number;
};

export type DayTrendRow = { day: string; count: number };

export type ServicerSummaryRow = {
  servicerId: string | null;
  servicerName: string;
  count: number;
  distinctDays: number;
  avgPerDay: number;
  topTypes: { label: string; count: number }[];
};

export type ServiceAnalyticsSnapshot = {
  ym: string;
  fromIso: string;
  toExclusiveIso: string;
  label: string;
  totals: ServiceAnalyticsTotals;
  byManufacturer: CountRow[];
  byAgent: CountRow[];
  byConstruction: CountRow[];
  byType: TypeBreakdownRow[];
  byDay: DayTrendRow[];
  byServicer: ServicerSummaryRow[];
};

function num(v: bigint | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "bigint" ? Number(v) : v;
}

function pct(internal: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((10000 * internal) / total) / 100;
}

/**
 * Glavni agregat servisne analitike za jedan kalendarski mjesec (UTC granice).
 */
export async function getServiceAnalyticsSnapshot(
  prisma: PrismaClient,
  companyId: string,
  ym: string,
): Promise<ServiceAnalyticsSnapshot> {
  const { from, toExclusive } = monthBoundsUtc(ym);
  const label = monthLabelHr(ym);

  const totalsRow = await prisma.$queryRaw<
    Array<{ serviced: bigint; internal_done: bigint }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS serviced,
      SUM(CASE WHEN woi."internalDone" THEN 1 ELSE 0 END)::bigint AS internal_done
    FROM "WorkOrderItem" woi
    WHERE woi."companyId" = ${companyId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
  `);
  const serviced = num(totalsRow[0]?.serviced);
  const internalDone = num(totalsRow[0]?.internal_done);

  const byManufacturerRaw = await prisma.$queryRaw<
    Array<{
      manufacturer_id: string;
      name: string;
      display_name: string | null;
      cnt: bigint;
      internal_cnt: bigint;
    }>
  >(Prisma.sql`
    SELECT
      m.id AS manufacturer_id,
      m.name,
      m."displayName" AS display_name,
      COUNT(*)::bigint AS cnt,
      SUM(CASE WHEN woi."internalDone" THEN 1 ELSE 0 END)::bigint AS internal_cnt
    FROM "WorkOrderItem" woi
    INNER JOIN "Extinguisher" e ON e.id = woi."extinguisherId"
    INNER JOIN "Manufacturer" m ON m.id = e."manufacturerId"
    WHERE woi."companyId" = ${companyId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
    GROUP BY m.id, m.name, m."displayName"
    ORDER BY cnt DESC
  `);

  const byManufacturer: CountRow[] = byManufacturerRaw.map((r) => {
    const c = num(r.cnt);
    const i = num(r.internal_cnt);
    return {
      key: r.manufacturer_id,
      label: displayManufacturer({ name: r.name, displayName: r.display_name }),
      count: c,
      internalDone: i,
      upPercent: pct(i, c),
    };
  });

  const byAgentRaw = await prisma.$queryRaw<
    Array<{ agent_id: string; agent_code: string; agent_label: string; cnt: bigint; internal_cnt: bigint }>
  >(Prisma.sql`
    SELECT
      at.id AS agent_id,
      at.code AS agent_code,
      at.label AS agent_label,
      COUNT(*)::bigint AS cnt,
      SUM(CASE WHEN woi."internalDone" THEN 1 ELSE 0 END)::bigint AS internal_cnt
    FROM "WorkOrderItem" woi
    INNER JOIN "Extinguisher" e ON e.id = woi."extinguisherId"
    INNER JOIN "ExtinguisherType" et ON et.id = e."extinguisherTypeId"
    INNER JOIN "AgentType" at ON at.id = et."agentId"
    WHERE woi."companyId" = ${companyId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
    GROUP BY at.id, at.code, at.label
    ORDER BY cnt DESC
  `);

  const byAgent: CountRow[] = byAgentRaw.map((r) => {
    const c = num(r.cnt);
    const i = num(r.internal_cnt);
    return {
      key: r.agent_id,
      label: r.agent_label || r.agent_code,
      count: c,
      internalDone: i,
      upPercent: pct(i, c),
    };
  });

  const byConstructionRaw = await prisma.$queryRaw<
    Array<{
      construction_id: string;
      construction_code: string;
      construction_label: string;
      cnt: bigint;
      internal_cnt: bigint;
    }>
  >(Prisma.sql`
    SELECT
      c.id AS construction_id,
      c.code AS construction_code,
      c.label AS construction_label,
      COUNT(*)::bigint AS cnt,
      SUM(CASE WHEN woi."internalDone" THEN 1 ELSE 0 END)::bigint AS internal_cnt
    FROM "WorkOrderItem" woi
    INNER JOIN "Extinguisher" e ON e.id = woi."extinguisherId"
    INNER JOIN "ExtinguisherType" et ON et.id = e."extinguisherTypeId"
    INNER JOIN "Construction" c ON c.id = et."constructionId"
    WHERE woi."companyId" = ${companyId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
    GROUP BY c.id, c.code, c.label
    ORDER BY cnt DESC
  `);

  const byConstruction: CountRow[] = byConstructionRaw.map((r) => {
    const c = num(r.cnt);
    const i = num(r.internal_cnt);
    return {
      key: r.construction_id,
      label: r.construction_label || r.construction_code,
      count: c,
      internalDone: i,
      upPercent: pct(i, c),
    };
  });

  const byTypeRaw = await prisma.$queryRaw<
    Array<{
      type_id: string;
      type_code: string;
      agent_code: string | null;
      agent_label: string | null;
      construction_code: string | null;
      construction_label: string | null;
      cnt: bigint;
      internal_cnt: bigint;
    }>
  >(Prisma.sql`
    SELECT
      et.id AS type_id,
      et.code AS type_code,
      at.code AS agent_code,
      at.label AS agent_label,
      c.code AS construction_code,
      c.label AS construction_label,
      COUNT(*)::bigint AS cnt,
      SUM(CASE WHEN woi."internalDone" THEN 1 ELSE 0 END)::bigint AS internal_cnt
    FROM "WorkOrderItem" woi
    INNER JOIN "Extinguisher" e ON e.id = woi."extinguisherId"
    INNER JOIN "ExtinguisherType" et ON et.id = e."extinguisherTypeId"
    INNER JOIN "AgentType" at ON at.id = et."agentId"
    INNER JOIN "Construction" c ON c.id = et."constructionId"
    WHERE woi."companyId" = ${companyId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
    GROUP BY et.id, et.code, at.code, at.label, c.code, c.label
    ORDER BY cnt DESC
    LIMIT 40
  `);

  const byType: TypeBreakdownRow[] = byTypeRaw.map((r) => {
    const c = num(r.cnt);
    const i = num(r.internal_cnt);
    const label = formatExtinguisherTypeName({
      code: r.type_code,
      agent: r.agent_code
        ? { code: r.agent_code ?? undefined, label: r.agent_label }
        : null,
      construction: r.construction_code
        ? { code: r.construction_code ?? undefined, label: r.construction_label }
        : null,
    });
    return {
      typeId: r.type_id,
      label,
      count: c,
      internalDone: i,
      upPercent: pct(i, c),
    };
  });

  const byDayRaw = await prisma.$queryRaw<Array<{ d: Date; cnt: bigint }>>(Prisma.sql`
    SELECT
      DATE_TRUNC('day', woi."servicedAt" AT TIME ZONE 'UTC')::date AS d,
      COUNT(*)::bigint AS cnt
    FROM "WorkOrderItem" woi
    WHERE woi."companyId" = ${companyId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  const byDay: DayTrendRow[] = byDayRaw.map((r) => ({
    day: r.d.toISOString().slice(0, 10),
    count: num(r.cnt),
  }));

  const servicerAgg = await prisma.$queryRaw<
    Array<{ servicer_id: string | null; cnt: bigint; days: bigint; internal_cnt: bigint }>
  >(Prisma.sql`
    SELECT
      woi."servicerId" AS servicer_id,
      COUNT(*)::bigint AS cnt,
      COUNT(DISTINCT DATE_TRUNC('day', woi."servicedAt" AT TIME ZONE 'UTC'))::bigint AS days,
      SUM(CASE WHEN woi."internalDone" THEN 1 ELSE 0 END)::bigint AS internal_cnt
    FROM "WorkOrderItem" woi
    WHERE woi."companyId" = ${companyId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
    GROUP BY woi."servicerId"
    ORDER BY cnt DESC
  `);

  const servicerTypeRaw = await prisma.$queryRaw<
    Array<{ servicer_id: string | null; type_id: string; cnt: bigint }>
  >(Prisma.sql`
    SELECT
      woi."servicerId" AS servicer_id,
      et.id AS type_id,
      COUNT(*)::bigint AS cnt
    FROM "WorkOrderItem" woi
    INNER JOIN "Extinguisher" e ON e.id = woi."extinguisherId"
    INNER JOIN "ExtinguisherType" et ON et.id = e."extinguisherTypeId"
    WHERE woi."companyId" = ${companyId}
      AND woi."isPlaceholder" = false
      AND woi."extinguisherId" IS NOT NULL
      AND woi."servicedAt" IS NOT NULL
      AND woi."servicedAt" >= ${from}
      AND woi."servicedAt" < ${toExclusive}
    GROUP BY woi."servicerId", et.id
  `);

  const typeIds = [...new Set(servicerTypeRaw.map((r) => r.type_id))];
  const types =
    typeIds.length === 0
      ? []
      : await prisma.extinguisherType.findMany({
          where: { id: { in: typeIds } },
          select: {
            id: true,
            code: true,
            agent: { select: { code: true, label: true } },
            construction: { select: { code: true, label: true } },
          },
        });
  const typeLabelById = new Map(
    types.map((t) => [
      t.id,
      formatExtinguisherTypeName({
        code: t.code,
        agent: t.agent,
        construction: t.construction,
      }),
    ]),
  );

  const topTypesByServicer = new Map<string | null, { label: string; count: number }[]>();
  for (const row of servicerTypeRaw) {
    const sid = row.servicer_id;
    const labelForType = typeLabelById.get(row.type_id) ?? row.type_id;
    const arr = topTypesByServicer.get(sid) ?? [];
    arr.push({ label: labelForType, count: num(row.cnt) });
    topTypesByServicer.set(sid, arr);
  }
  for (const [k, arr] of topTypesByServicer) {
    arr.sort((a, b) => b.count - a.count);
    topTypesByServicer.set(k, arr.slice(0, 3));
  }

  const servicerIds = servicerAgg.map((r) => r.servicer_id).filter((id): id is string => id != null);
  const users =
    servicerIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: servicerIds }, companyId },
          select: { id: true, fullName: true },
        });
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));

  const byServicer: ServicerSummaryRow[] = servicerAgg.map((r) => {
    const c = num(r.cnt);
    const days = Math.max(1, num(r.days));
    return {
      servicerId: r.servicer_id,
      servicerName: r.servicer_id ? (nameById.get(r.servicer_id) ?? "Nepoznato") : "Bez servisera",
      count: c,
      distinctDays: num(r.days),
      avgPerDay: Math.round((100 * c) / days) / 100,
      topTypes: topTypesByServicer.get(r.servicer_id) ?? [],
    };
  });

  return {
    ym,
    fromIso: from.toISOString(),
    toExclusiveIso: toExclusive.toISOString(),
    label,
    totals: {
      serviced,
      internalDone,
      upPercent: pct(internalDone, serviced),
    },
    byManufacturer,
    byAgent,
    byConstruction,
    byType,
    byDay,
    byServicer,
  };
}
