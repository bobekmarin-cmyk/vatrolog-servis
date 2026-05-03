import { prisma } from "@/lib/prisma";
import { customerDisplayName } from "@/lib/customerDisplay";
import type { Prisma } from "@prisma/client";

export interface MonthCustomerRow {
  id: string;
  name: string;
  email: string | null;
  totalDue: number;
  alreadyServiced: number;
  pickedUp: number;
  autoNotify: boolean;
  departmentId?: string;
}

export interface MonthRange {
  /** uključivi donji datum; za "current" = prvi u mjesecu; za "overdue" = prvi u referentnom mjesecu (sve prije pada u zaostatak) */
  from: Date;
  /** ekskluzivni gornji datum; potreban samo za "current" mode */
  to?: Date;
  mode: "current" | "overdue";
}

/**
 * Sastavlja popis kupaca i agregirane brojeve za popis po mjesecima.
 *
 * Modi:
 *  - "current": ističe u zadanom mjesecu (gte from, lt to).
 *      totalDue        = unique aparati po kupcu čiji originalni rok pada u raspon
 *      alreadyServiced = od toga, aparati koji su već servisirani (WOI.servicedAt != null)
 *      pickedUp        = od toga, aparati preuzeti na aktivan nalog (DRAFT/IN_PROGRESS) ali nisu servisirani
 *
 *  - "overdue": istekli rokovi prije trenutnog mjeseca.
 *      Uračunati se SAMO aparati koji su stvarno zaostali kod kupca — Extinguisher.nextPeriodicDue < from
 *      I nisu preuzeti ni na jedan aktivan nalog (DRAFT/IN_PROGRESS). Preuzeti aparati nisu
 *      zaostaci jer su već u radionici. Servisirani WOI iz prošlosti se također isključuju
 *      (nextPeriodicDue im je u budućnosti). alreadyServiced i pickedUp su u overdue uvijek 0.
 *
 * Izvor 1 ("skup A"): WorkOrderItem.
 * Izvor 2 ("skup B"): Extinguisher s prikladnim nextPeriodicDue, ne u skupu A.
 *                     Kupca mapiramo preko zadnjeg servisa.
 *
 * Napomena: svi aparati imaju 12-mjesečni PP ciklus. Unutarnji pregled (UP) se uvijek
 * odrađuje uz PP u istom mjesecu i ne vodi se kao zaseban rok u popisu po mjesecima.
 */
export async function buildMonthData(
  companyId: string,
  range: MonthRange,
): Promise<{ rows: MonthCustomerRow[]; totalItems: number }> {
  const { from, to, mode } = range;

  const woiWhere: Prisma.WorkOrderItemWhereInput =
    mode === "current"
      ? {
          companyId,
          extinguisherId: { not: null },
          isPlaceholder: false,
          targetPeriodicMonth: { gte: from, lt: to! },
        }
      : {
          companyId,
          extinguisherId: { not: null },
          isPlaceholder: false,
          targetPeriodicMonth: { lt: from },
          // u overdue modu računamo samo neservisirane stavke na aktivnim nalozima
          servicedAt: null,
          workOrder: { status: { in: ["DRAFT", "IN_PROGRESS"] } },
        };

  const extDateFilter =
    mode === "current"
      ? { nextPeriodicDue: { gte: from, lt: to! } }
      : { nextPeriodicDue: { lt: from } };

  const woisInMonth = await prisma.workOrderItem.findMany({
    where: woiWhere,
    orderBy: [{ servicedAt: "desc" }, { createdAt: "desc" }],
    include: {
      workOrder: {
        include: {
          customer: true,
          department: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const byExtA = new Map<string, (typeof woisInMonth)[number]>();
  for (const w of woisInMonth) {
    if (!w.extinguisherId) continue;
    const existing = byExtA.get(w.extinguisherId);
    if (!existing) {
      byExtA.set(w.extinguisherId, w);
      continue;
    }
    if (w.servicedAt && !existing.servicedAt) {
      byExtA.set(w.extinguisherId, w);
    } else if (!!w.servicedAt === !!existing.servicedAt) {
      const tA = (w.servicedAt ?? w.createdAt).getTime();
      const tE = (existing.servicedAt ?? existing.createdAt).getTime();
      if (tA > tE) byExtA.set(w.extinguisherId, w);
    }
  }

  const extIdsInA = Array.from(byExtA.keys());

  const extsInMonth = await prisma.extinguisher.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      ...(extIdsInA.length > 0 ? { id: { notIn: extIdsInA } } : {}),
      ...extDateFilter,
    },
    select: { id: true },
  });
  const extIdsInB = extsInMonth.map((e) => e.id);

  const latestWoisB =
    extIdsInB.length > 0
      ? await prisma.workOrderItem.findMany({
          where: {
            companyId,
            extinguisherId: { in: extIdsInB },
            servicedAt: { not: null },
            isPlaceholder: false,
          },
          orderBy: { servicedAt: "desc" },
          distinct: ["extinguisherId"],
          include: {
            workOrder: {
              include: {
                customer: true,
                department: { select: { id: true, name: true, email: true } },
              },
            },
          },
        })
      : [];

  // U overdue modu skup A se koristi samo kao exclusion lista (preuzeti ne ulaze u zaostatke).
  const totalItems =
    mode === "overdue" ? extIdsInB.length : extIdsInA.length + extIdsInB.length;

  const byKey = new Map<string, MonthCustomerRow>();

  function upsert(params: {
    customerId: string;
    customerName: string;
    customerEmail: string | null;
    customerAutoNotify: boolean;
    departmentId?: string;
    isServiced: boolean;
    isPickedUp: boolean;
  }) {
    const {
      customerId,
      customerName,
      customerEmail,
      customerAutoNotify,
      departmentId,
      isServiced,
      isPickedUp,
    } = params;
    const key = departmentId ? `${customerId}::${departmentId}` : customerId;
    const existing = byKey.get(key);
    if (existing) {
      existing.totalDue++;
      if (isServiced) existing.alreadyServiced++;
      if (isPickedUp) existing.pickedUp++;
    } else {
      byKey.set(key, {
        id: customerId,
        name: customerName,
        email: customerEmail,
        totalDue: 1,
        alreadyServiced: isServiced ? 1 : 0,
        pickedUp: isPickedUp ? 1 : 0,
        autoNotify: customerAutoNotify,
        departmentId,
      });
    }
  }

  // U overdue modu preskačemo skup A — preuzeti aparati nisu zaostaci (u radionici su).
  if (mode === "current") {
    for (const w of byExtA.values()) {
      const c = w.workOrder.customer;
      const dept = w.workOrder.department;
      const displayName = dept
        ? `${customerDisplayName(c)} / ${dept.name}`
        : customerDisplayName(c);
      const email = dept?.email || c.email;
      const isServiced = !!w.servicedAt;
      const isPickedUp =
        !isServiced &&
        (w.workOrder.status === "DRAFT" || w.workOrder.status === "IN_PROGRESS");
      upsert({
        customerId: c.id,
        customerName: displayName,
        customerEmail: email,
        customerAutoNotify: c.autoNotify,
        departmentId: dept?.id ?? undefined,
        isServiced,
        isPickedUp,
      });
    }
  }

  for (const w of latestWoisB) {
    const c = w.workOrder.customer;
    const dept = w.workOrder.department;
    const displayName = dept
      ? `${customerDisplayName(c)} / ${dept.name}`
      : customerDisplayName(c);
    const email = dept?.email || c.email;
    upsert({
      customerId: c.id,
      customerName: displayName,
      customerEmail: email,
      customerAutoNotify: c.autoNotify,
      departmentId: dept?.id ?? undefined,
      isServiced: false,
      isPickedUp: false,
    });
  }

  const rows = Array.from(byKey.values()).sort((a, b) => b.totalDue - a.totalDue);
  return { rows, totalItems };
}

/**
 * Broj preostalih (neservisiranih) aparata za kupca u zadanom mjesecu/modu.
 * Koristi se za izračun količine u obavijesti (itemCount = totalDue - alreadyServiced).
 */
export async function countRemainingForCustomer(
  companyId: string,
  customerId: string,
  departmentId: string | null,
  range: MonthRange,
): Promise<number> {
  const { rows } = await buildMonthData(companyId, range);
  const row = rows.find(
    (r) => r.id === customerId && (r.departmentId ?? null) === departmentId,
  );
  if (!row) return 0;
  return Math.max(0, row.totalDue - row.alreadyServiced);
}
