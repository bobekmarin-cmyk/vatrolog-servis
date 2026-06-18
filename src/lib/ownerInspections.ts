import { prisma } from "@/lib/prisma";
import { getOwnerActiveLinks } from "@/lib/ownerPortalData";
import { resolveOwnerOrgId } from "@/lib/ownerOrg";

/**
 * Redovni (tromjesečni) pregled — logika privatna za vlasnika. Rok idućeg
 * pregleda se računa iz zadnjeg pregleda; ne dira servisne rokove aparata.
 */

export const REGULAR_INSPECTION_INTERVAL_MONTHS = 3;
const DUE_SOON_DAYS = 14;

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

function manufacturerLabel(m: { name: string; displayName: string | null }): string {
  const d = m.displayName?.trim();
  return d && d.length > 0 ? d : m.name;
}

export type OwnerExtinguisherAccess = {
  extinguisherId: string;
  companyId: string;
  internalCode: string;
  serialNumber: string;
  typeCode: string | null;
  manufacturerName: string;
  servicerName: string;
};

const EXT_SELECT = {
  id: true,
  internalCode: true,
  serialNumber: true,
  type: { select: { code: true } },
  manufacturer: { select: { name: true, displayName: true } },
} as const;

/**
 * Provjeri da prijavljeni vlasnik smije unijeti pregled za ovaj aparat: mora
 * imati ACTIVE vezu s kupcem te tvrtke, a aparat se mora pojavljivati na nekom
 * nalogu tog kupca.
 */
export async function ownerCanAccessExtinguisher(
  ownerId: string,
  companyId: string,
  extinguisherId: string,
): Promise<OwnerExtinguisherAccess | null> {
  const ownerOrgId = await resolveOwnerOrgId(ownerId);
  if (!ownerOrgId) return null;
  const links = await prisma.ownerCustomerLink.findMany({
    where: { ownerOrgId, status: "ACTIVE", hiddenByVendorAt: null, companyId },
    select: { customerId: true, company: { select: { name: true } } },
  });
  if (links.length === 0) return null;

  const customerIds = links.map((l) => l.customerId);
  const item = await prisma.workOrderItem.findFirst({
    where: { companyId, extinguisherId, workOrder: { customerId: { in: customerIds } } },
    select: { id: true },
  });
  if (!item) return null;

  const e = await prisma.extinguisher.findFirst({
    where: { id: extinguisherId, companyId, deletedAt: null },
    select: EXT_SELECT,
  });
  if (!e) return null;

  return {
    extinguisherId: e.id,
    companyId,
    internalCode: e.internalCode,
    serialNumber: e.serialNumber,
    typeCode: e.type?.code ?? null,
    manufacturerName: manufacturerLabel(e.manufacturer),
    servicerName: links[0].company.name,
  };
}

/**
 * Razriješi aparate po internoj oznaci (QR/ručni unos) među svim ACTIVE vezama
 * vlasnika. Vraća listu — ista oznaka može postojati kod više servisa, pa
 * vlasnik bira.
 */
export async function resolveOwnerExtinguishersByCode(
  ownerId: string,
  code: string,
): Promise<OwnerExtinguisherAccess[]> {
  const trimmed = code.trim();
  if (!trimmed) return [];

  const links = await getOwnerActiveLinks(ownerId);
  const byExt = new Map<string, OwnerExtinguisherAccess>();

  for (const link of links) {
    const e = await prisma.extinguisher.findFirst({
      where: {
        companyId: link.companyId,
        internalCode: trimmed,
        deletedAt: null,
        workItems: { some: { workOrder: { customerId: link.customerId } } },
      },
      select: EXT_SELECT,
    });
    if (!e || byExt.has(e.id)) continue;
    byExt.set(e.id, {
      extinguisherId: e.id,
      companyId: link.companyId,
      internalCode: e.internalCode,
      serialNumber: e.serialNumber,
      typeCode: e.type?.code ?? null,
      manufacturerName: manufacturerLabel(e.manufacturer),
      servicerName: link.companyName,
    });
  }

  return [...byExt.values()];
}

export type InspectionState = {
  lastInspectedAt: Date | null;
  /** Sidro rasporeda: zadnji redovni pregled ili (ako ga nema) periodični servis. */
  anchor: Date | null;
  anchorIsPeriodic: boolean;
  nextDue: Date | null;
  overdue: boolean;
  dueSoon: boolean;
  /** Nema rasporeda jer aparat još nije periodično servisiran niti ima redovni pregled. */
  noSchedule: boolean;
};

export type InspectionStateInput = { id: string; lastPeriodicAt: Date | null };

/**
 * Zadnji pregled + izračunati rok za svaki aparat.
 *
 * Pravilo (po dogovoru): prvi redovni pregled je 3 mjeseca NAKON periodičnog
 * servisa, a svaki sljedeći 3 mjeseca nakon zadnjeg redovnog pregleda. Stoga je
 * sidro = zadnji redovni pregled, a ako ga nema = datum periodičnog servisa.
 */
export async function getOwnerInspectionStates(
  ownerId: string,
  exts: InspectionStateInput[],
): Promise<Map<string, InspectionState>> {
  const map = new Map<string, InspectionState>();
  if (exts.length === 0) return map;

  const ownerOrgId = await resolveOwnerOrgId(ownerId);
  const extinguisherIds = exts.map((e) => e.id);
  const rows = ownerOrgId
    ? await prisma.regularInspection.findMany({
        where: { ownerOrgId, extinguisherId: { in: extinguisherIds } },
        select: { extinguisherId: true, inspectedAt: true },
        orderBy: { inspectedAt: "desc" },
      })
    : [];

  const lastByExt = new Map<string, Date>();
  for (const r of rows) {
    if (!lastByExt.has(r.extinguisherId)) lastByExt.set(r.extinguisherId, r.inspectedAt);
  }

  const now = new Date();
  const soonCutoff = new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000);

  for (const ext of exts) {
    const last = lastByExt.get(ext.id) ?? null;
    const anchor = last ?? ext.lastPeriodicAt;
    if (!anchor) {
      map.set(ext.id, {
        lastInspectedAt: last,
        anchor: null,
        anchorIsPeriodic: false,
        nextDue: null,
        overdue: false,
        dueSoon: false,
        noSchedule: true,
      });
      continue;
    }
    const nextDue = addMonths(anchor, REGULAR_INSPECTION_INTERVAL_MONTHS);
    map.set(ext.id, {
      lastInspectedAt: last,
      anchor,
      anchorIsPeriodic: !last,
      nextDue,
      overdue: nextDue < now,
      dueSoon: nextDue >= now && nextDue <= soonCutoff,
      noSchedule: false,
    });
  }

  return map;
}

export type OwnerInspectionHistoryRow = {
  id: string;
  inspectedAt: Date;
  result: "OK" | "ISSUES";
  internalCode: string;
  servicerName: string;
  note: string | null;
  performedByName: string | null;
};

export async function getOwnerInspectionHistory(
  ownerId: string,
  take = 200,
): Promise<OwnerInspectionHistoryRow[]> {
  const ownerOrgId = await resolveOwnerOrgId(ownerId);
  if (!ownerOrgId) return [];
  const rows = await prisma.regularInspection.findMany({
    where: { ownerOrgId },
    orderBy: { inspectedAt: "desc" },
    take,
    select: {
      id: true,
      inspectedAt: true,
      result: true,
      note: true,
      performedByName: true,
      extinguisher: { select: { internalCode: true } },
      company: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    inspectedAt: r.inspectedAt,
    result: r.result,
    internalCode: r.extinguisher.internalCode,
    servicerName: r.company.name,
    note: r.note,
    performedByName: r.performedByName,
  }));
}
