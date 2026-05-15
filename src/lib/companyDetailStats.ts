/**
 * Per-company statistike za platform company detail stranicu.
 *
 * Svaki helper vraca read-only agregate za jedan tab — koristi se iz
 * `src/app/platform/companies/[companyId]/_tabs/*Tab.tsx` server komponenti.
 *
 * Svi upiti se izvode preko `Promise.all` kako bi se izbjeglo sekvencijalno cekanje.
 */
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_MONTHS = 12;

function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function buildMonthBuckets(months: number): { keys: string[]; startMs: number[] } {
  const keys: string[] = [];
  const startMs: number[] = [];
  const now = new Date();
  const thisMonth = startOfMonthUtc(now);
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    startMs.push(d.getTime());
  }
  return { keys, startMs };
}

function buildDayBuckets(days: number): { keys: string[]; startMs: number[] } {
  const keys: string[] = [];
  const startMs: number[] = [];
  const today = startOfDayUtc(new Date()).getTime();
  for (let i = days - 1; i >= 0; i -= 1) {
    const ms = today - i * DAY_MS;
    keys.push(new Date(ms).toISOString().slice(0, 10));
    startMs.push(ms);
  }
  return { keys, startMs };
}

function fillMonthBuckets(rows: { createdAt: Date }[], buckets: ReturnType<typeof buildMonthBuckets>): number[] {
  const counts = new Array<number>(buckets.startMs.length).fill(0);
  if (counts.length === 0) return counts;
  const oldest = buckets.startMs[0];
  for (const r of rows) {
    const t = r.createdAt.getTime();
    if (t < oldest) continue;
    let idx = counts.length - 1;
    for (let i = buckets.startMs.length - 1; i >= 0; i -= 1) {
      if (t >= buckets.startMs[i]) {
        idx = i;
        break;
      }
    }
    counts[idx] += 1;
  }
  return counts;
}

function fillDayBuckets<T extends { sentAt?: Date; createdAt?: Date }>(
  rows: T[],
  buckets: ReturnType<typeof buildDayBuckets>,
  dateKey: "sentAt" | "createdAt",
): number[] {
  const counts = new Array<number>(buckets.startMs.length).fill(0);
  if (counts.length === 0) return counts;
  const oldest = buckets.startMs[0];
  for (const r of rows) {
    const v = r[dateKey];
    if (!v) continue;
    const t = (v as Date).getTime();
    if (t < oldest) continue;
    const idx = Math.floor((t - oldest) / DAY_MS);
    if (idx >= 0 && idx < counts.length) counts[idx] += 1;
  }
  return counts;
}

// ───────────────────────── OVERVIEW ─────────────────────────

export type OverviewStats = {
  counts: {
    extinguishers: number;
    extinguishersActive: number;
    extinguishersScrapped: number;
    customers: number;
    workOrders: number;
    workOrdersDraft: number;
    workOrdersInProgress: number;
    workOrdersLocked: number;
    accounts: number;
    activeAccounts: number;
    emails30d: number;
    emailsFailed30d: number;
    invoices: number;
    invoicesOpen: number;
  };
  trend: {
    months: string[]; // ["2025-06", ..., "2026-05"]
    workOrders: number[];
    workOrdersFinished: number[];
  };
  extinguisherByStatus: { status: string; count: number }[];
  lastLoginAt: Date | null;
};

export async function getOverviewStats(companyId: string): Promise<OverviewStats> {
  const monthBuckets = buildMonthBuckets(TREND_MONTHS);
  const startTrend = new Date(monthBuckets.startMs[0]);
  const since30d = new Date(Date.now() - 30 * DAY_MS);

  const [
    extByStatus,
    customersTotal,
    woStatusGroup,
    workOrdersAllTime,
    accountsTotal,
    accountsActive,
    emails30d,
    emailsFailed30d,
    invoicesGroup,
    workOrdersTrendRows,
    workOrdersFinishedTrendRows,
    lastLoginAgg,
  ] = await Promise.all([
    prisma.extinguisher.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.customer.count({ where: { companyId, deletedAt: null } }),
    prisma.workOrder.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    }),
    prisma.workOrder.count({ where: { companyId } }),
    prisma.accountUser.count({ where: { companyId } }),
    prisma.accountUser.count({ where: { companyId, active: true } }),
    prisma.emailLog.count({ where: { companyId, sentAt: { gte: since30d } } }),
    prisma.emailLog.count({
      where: { companyId, sentAt: { gte: since30d }, status: "FAILED" },
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    }),
    prisma.workOrder.findMany({
      where: { companyId, createdAt: { gte: startTrend } },
      select: { createdAt: true },
    }),
    prisma.workOrder.findMany({
      where: { companyId, finishedAt: { gte: startTrend, not: null } },
      select: { finishedAt: true },
    }),
    prisma.accountUser.aggregate({ where: { companyId }, _max: { lastLoginAt: true } }),
  ]);

  const extActive = extByStatus.find((x) => x.status === "ACTIVE")?._count._all ?? 0;
  const extScrapped = extByStatus.find((x) => x.status === "SCRAPPED")?._count._all ?? 0;
  const extLost = extByStatus.find((x) => x.status === "LOST")?._count._all ?? 0;

  const woDraft = woStatusGroup.find((x) => x.status === "DRAFT")?._count._all ?? 0;
  const woInProgress = woStatusGroup.find((x) => x.status === "IN_PROGRESS")?._count._all ?? 0;
  const woLocked = woStatusGroup.find((x) => x.status === "LOCKED")?._count._all ?? 0;

  const invoicesTotal = invoicesGroup.reduce((s, g) => s + g._count._all, 0);
  const invoicesOpen = invoicesGroup
    .filter((g) => g.status === "ISSUED" || g.status === "OVERDUE" || g.status === "DRAFT")
    .reduce((s, g) => s + g._count._all, 0);

  const workOrdersTrend = fillMonthBuckets(workOrdersTrendRows, monthBuckets);
  const workOrdersFinishedTrend = fillMonthBuckets(
    workOrdersFinishedTrendRows.map((r) => ({ createdAt: r.finishedAt! })),
    monthBuckets,
  );

  return {
    counts: {
      extinguishers: extActive + extScrapped + extLost,
      extinguishersActive: extActive,
      extinguishersScrapped: extScrapped,
      customers: customersTotal,
      workOrders: workOrdersAllTime,
      workOrdersDraft: woDraft,
      workOrdersInProgress: woInProgress,
      workOrdersLocked: woLocked,
      accounts: accountsTotal,
      activeAccounts: accountsActive,
      emails30d,
      emailsFailed30d,
      invoices: invoicesTotal,
      invoicesOpen,
    },
    trend: {
      months: monthBuckets.keys,
      workOrders: workOrdersTrend,
      workOrdersFinished: workOrdersFinishedTrend,
    },
    extinguisherByStatus: extByStatus.map((g) => ({ status: g.status, count: g._count._all })),
    lastLoginAt: lastLoginAgg._max.lastLoginAt ?? null,
  };
}

// ───────────────────────── INVENTORY (aparati + kupci) ─────────────────────────

export type InventoryStats = {
  extinguisherCounts: {
    total: number;
    active: number;
    scrapped: number;
    lost: number;
  };
  byManufacturer: { manufacturerId: string; manufacturerName: string; count: number }[];
  byType: { extinguisherTypeId: string; typeCode: string; typeName: string; count: number }[];
  latestExtinguishers: {
    id: string;
    internalCode: string;
    serialNumber: string;
    productionYear: number;
    status: string;
    typeName: string;
    manufacturerName: string;
    createdAt: Date;
  }[];
  customerCounts: { total: number; legal: number; person: number };
  topCustomers: {
    customerId: string;
    name: string;
    workOrderCount: number;
  }[];
  recentCustomers: {
    id: string;
    name: string;
    type: string;
    city: string | null;
    oib: string;
    createdAt: Date;
  }[];
};

export async function getInventoryStats(companyId: string): Promise<InventoryStats> {
  const [
    extByStatus,
    byMan,
    byType,
    latestExts,
    customerGroup,
    topCustomerGroup,
    recentCustomers,
  ] = await Promise.all([
    prisma.extinguisher.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.extinguisher.groupBy({
      by: ["manufacturerId"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.extinguisher.groupBy({
      by: ["extinguisherTypeId"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.extinguisher.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        internalCode: true,
        serialNumber: true,
        productionYear: true,
        status: true,
        createdAt: true,
        type: { select: { name: true } },
        manufacturer: { select: { name: true, displayName: true } },
      },
    }),
    prisma.customer.groupBy({
      by: ["type"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.workOrder.groupBy({
      by: ["customerId"],
      where: { companyId },
      _count: { _all: true },
      orderBy: { _count: { customerId: "desc" } },
      take: 10,
    }),
    prisma.customer.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        oib: true,
        createdAt: true,
      },
    }),
  ]);

  // Resolve manufacturer names
  const manIds = byMan.map((g) => g.manufacturerId);
  const manufacturers = manIds.length
    ? await prisma.manufacturer.findMany({
        where: { id: { in: manIds } },
        select: { id: true, name: true, displayName: true },
      })
    : [];
  const manById = new Map(manufacturers.map((m) => [m.id, m.displayName || m.name]));

  // Resolve type names
  const typeIds = byType.map((g) => g.extinguisherTypeId);
  const types = typeIds.length
    ? await prisma.extinguisherType.findMany({
        where: { id: { in: typeIds } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const typeById = new Map(types.map((t) => [t.id, t]));

  // Resolve top customer names
  const topCustomerIds = topCustomerGroup.map((g) => g.customerId);
  const topCustomerEntities = topCustomerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: topCustomerIds } },
        select: { id: true, name: true },
      })
    : [];
  const topCustomerById = new Map(topCustomerEntities.map((c) => [c.id, c.name]));

  const extActive = extByStatus.find((x) => x.status === "ACTIVE")?._count._all ?? 0;
  const extScrapped = extByStatus.find((x) => x.status === "SCRAPPED")?._count._all ?? 0;
  const extLost = extByStatus.find((x) => x.status === "LOST")?._count._all ?? 0;

  const customerLegal = customerGroup.find((x) => x.type === "LEGAL")?._count._all ?? 0;
  const customerPerson = customerGroup.find((x) => x.type === "PERSON")?._count._all ?? 0;

  return {
    extinguisherCounts: {
      total: extActive + extScrapped + extLost,
      active: extActive,
      scrapped: extScrapped,
      lost: extLost,
    },
    byManufacturer: byMan.map((g) => ({
      manufacturerId: g.manufacturerId,
      manufacturerName: manById.get(g.manufacturerId) ?? "—",
      count: g._count._all,
    })),
    byType: byType.map((g) => {
      const t = typeById.get(g.extinguisherTypeId);
      return {
        extinguisherTypeId: g.extinguisherTypeId,
        typeCode: t?.code ?? "—",
        typeName: t?.name ?? "—",
        count: g._count._all,
      };
    }),
    latestExtinguishers: latestExts.map((e) => ({
      id: e.id,
      internalCode: e.internalCode,
      serialNumber: e.serialNumber,
      productionYear: e.productionYear,
      status: e.status,
      typeName: e.type.name,
      manufacturerName: e.manufacturer.displayName || e.manufacturer.name,
      createdAt: e.createdAt,
    })),
    customerCounts: {
      total: customerLegal + customerPerson,
      legal: customerLegal,
      person: customerPerson,
    },
    topCustomers: topCustomerGroup
      .map((g) => ({
        customerId: g.customerId,
        name: topCustomerById.get(g.customerId) ?? "—",
        workOrderCount: g._count._all,
      }))
      .filter((c) => c.name !== "—"),
    recentCustomers: recentCustomers.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      city: c.city,
      oib: c.oib,
      createdAt: c.createdAt,
    })),
  };
}

// ───────────────────────── OPERATIONS (nalozi + dokumenti) ─────────────────────────

export type OperationsStats = {
  workOrderCounts: {
    total: number;
    draft: number;
    inProgress: number;
    locked: number;
  };
  workOrdersByMonth: { months: string[]; counts: number[] };
  latestWorkOrders: {
    id: string;
    orderNumber: string;
    status: string;
    customerName: string;
    receivedAt: Date;
    finishedAt: Date | null;
    lockedAt: Date | null;
    createdAt: Date;
  }[];
  invoiceCounts: {
    total: number;
    byStatus: { status: string; count: number }[];
  };
  latestInvoices: {
    id: string;
    number: string;
    status: string;
    total: number;
    issuedAt: Date | null;
    paidAt: Date | null;
    customerName: string | null;
  }[];
  documentLogCounts: { docType: string; count: number; last30d: number }[];
};

export async function getOperationsStats(companyId: string): Promise<OperationsStats> {
  const monthBuckets = buildMonthBuckets(TREND_MONTHS);
  const startTrend = new Date(monthBuckets.startMs[0]);
  const since30d = new Date(Date.now() - 30 * DAY_MS);

  const [
    woStatusGroup,
    woTrendRows,
    latestWorkOrders,
    invoiceGroup,
    latestInvoices,
    docLogGroup,
    docLogRecent,
  ] = await Promise.all([
    prisma.workOrder.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    }),
    prisma.workOrder.findMany({
      where: { companyId, createdAt: { gte: startTrend } },
      select: { createdAt: true },
    }),
    prisma.workOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        receivedAt: true,
        finishedAt: true,
        lockedAt: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    }),
    prisma.invoice.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        issuedAt: true,
        paidAt: true,
        customerId: true,
      },
    }),
    prisma.documentLog.groupBy({
      by: ["docType"],
      where: { companyId },
      _count: { _all: true },
    }),
    prisma.documentLog.groupBy({
      by: ["docType"],
      where: { companyId, createdAt: { gte: since30d } },
      _count: { _all: true },
    }),
  ]);

  const recentByType = new Map(docLogRecent.map((g) => [g.docType, g._count._all]));

  const customerIds = Array.from(
    new Set(latestInvoices.map((i) => i.customerId).filter((x): x is string => !!x)),
  );
  const invCustomers = customerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true },
      })
    : [];
  const invCustomerById = new Map(invCustomers.map((c) => [c.id, c.name]));

  const woDraft = woStatusGroup.find((x) => x.status === "DRAFT")?._count._all ?? 0;
  const woInProgress = woStatusGroup.find((x) => x.status === "IN_PROGRESS")?._count._all ?? 0;
  const woLocked = woStatusGroup.find((x) => x.status === "LOCKED")?._count._all ?? 0;

  return {
    workOrderCounts: {
      total: woDraft + woInProgress + woLocked,
      draft: woDraft,
      inProgress: woInProgress,
      locked: woLocked,
    },
    workOrdersByMonth: {
      months: monthBuckets.keys,
      counts: fillMonthBuckets(woTrendRows, monthBuckets),
    },
    latestWorkOrders: latestWorkOrders.map((w) => ({
      id: w.id,
      orderNumber: w.orderNumber,
      status: w.status,
      customerName: w.customer.name,
      receivedAt: w.receivedAt,
      finishedAt: w.finishedAt,
      lockedAt: w.lockedAt,
      createdAt: w.createdAt,
    })),
    invoiceCounts: {
      total: invoiceGroup.reduce((s, g) => s + g._count._all, 0),
      byStatus: invoiceGroup.map((g) => ({ status: g.status, count: g._count._all })),
    },
    latestInvoices: latestInvoices.map((i) => ({
      id: i.id,
      number: i.number,
      status: i.status,
      total: Number(i.total),
      issuedAt: i.issuedAt,
      paidAt: i.paidAt,
      customerName: i.customerId ? invCustomerById.get(i.customerId) ?? null : null,
    })),
    documentLogCounts: docLogGroup
      .map((g) => ({
        docType: g.docType,
        count: g._count._all,
        last30d: recentByType.get(g.docType) ?? 0,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

// ───────────────────────── COMMUNICATIONS (emaillog + audit) ─────────────────────────

export type EmailLogFilter = {
  status?: string | null; // SENT, FAILED, …
  kind?: string | null;
};

export type CommunicationStats = {
  countsByStatus: { status: string; count: number }[];
  countsByKind: { kind: string; count: number }[];
  trend30d: {
    keys: string[];
    sent: number[];
    failed: number[];
  };
  latestEmails: {
    id: string;
    sentAt: Date;
    toEmail: string;
    subject: string;
    kind: string;
    status: string;
    transport: string | null;
    error: string | null;
  }[];
};

export async function getCommunicationStats(
  companyId: string,
  filter: EmailLogFilter = {},
): Promise<CommunicationStats> {
  const dayBuckets = buildDayBuckets(30);
  const since30d = new Date(dayBuckets.startMs[0]);
  const baseWhere = { companyId } as const;
  const listWhere: Record<string, unknown> = { companyId };
  if (filter.status) listWhere.status = filter.status;
  if (filter.kind) listWhere.kind = filter.kind;

  const [byStatus, byKind, sentRows, failedRows, latestEmails] = await Promise.all([
    prisma.emailLog.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.emailLog.groupBy({
      by: ["kind"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.emailLog.findMany({
      where: { companyId, sentAt: { gte: since30d }, status: { not: "FAILED" } },
      select: { sentAt: true },
    }),
    prisma.emailLog.findMany({
      where: { companyId, sentAt: { gte: since30d }, status: "FAILED" },
      select: { sentAt: true },
    }),
    prisma.emailLog.findMany({
      where: listWhere,
      orderBy: { sentAt: "desc" },
      take: 50,
      select: {
        id: true,
        sentAt: true,
        toEmail: true,
        subject: true,
        kind: true,
        status: true,
        transport: true,
        error: true,
      },
    }),
  ]);

  return {
    countsByStatus: byStatus
      .map((g) => ({ status: g.status, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    countsByKind: byKind
      .map((g) => ({ kind: g.kind, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    trend30d: {
      keys: dayBuckets.keys,
      sent: fillDayBuckets(sentRows, dayBuckets, "sentAt"),
      failed: fillDayBuckets(failedRows, dayBuckets, "sentAt"),
    },
    latestEmails,
  };
}

// ───────────────────────── SERVICE LOCATIONS (za accounts tab) ─────────────────────────

export type ServiceLocationRow = {
  id: string;
  kind: string;
  label: string;
  ordinal: number;
  active: boolean;
  accountCount: number;
  workOrderCount: number;
};

export async function getServiceLocationStats(companyId: string): Promise<ServiceLocationRow[]> {
  const [locations, accountGroup, woGroup] = await Promise.all([
    prisma.companyServiceLocation.findMany({
      where: { companyId },
      orderBy: [{ kind: "asc" }, { ordinal: "asc" }],
      select: { id: true, kind: true, label: true, ordinal: true, active: true },
    }),
    prisma.accountUser.groupBy({
      by: ["serviceLocationId"],
      where: { companyId },
      _count: { _all: true },
    }),
    prisma.workOrder.groupBy({
      by: ["serviceLocationId"],
      where: { companyId },
      _count: { _all: true },
    }),
  ]);
  const accountByLoc = new Map(
    accountGroup
      .filter((g) => g.serviceLocationId)
      .map((g) => [g.serviceLocationId as string, g._count._all]),
  );
  const woByLoc = new Map(
    woGroup
      .filter((g) => g.serviceLocationId)
      .map((g) => [g.serviceLocationId as string, g._count._all]),
  );
  return locations.map((l) => ({
    ...l,
    accountCount: accountByLoc.get(l.id) ?? 0,
    workOrderCount: woByLoc.get(l.id) ?? 0,
  }));
}
