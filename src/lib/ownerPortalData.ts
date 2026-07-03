import { prisma } from "@/lib/prisma";

/**
 * Read-only agregacija podataka za Korisnički portal. Vlasnik vidi sve kupce
 * (po tvrtkama) s kojima aktivni OwnerOrg ima ACTIVE i nesakrivenu vezu —
 * aparate, naloge i otpremnice. Funkcije primaju `ownerOrgId` (aktivni subjekt).
 */

export type OwnerLinkInfo = {
  linkId: string;
  companyId: string;
  customerId: string;
  companyName: string;
  customerName: string;
};

/** ACTIVE i nesakrivene veze (po vendor toggleu) za zadani org. */
export async function getOwnerActiveLinks(ownerOrgId: string | null): Promise<OwnerLinkInfo[]> {
  if (!ownerOrgId) return [];
  const links = await prisma.ownerCustomerLink.findMany({
    // Servisi na Start planu nemaju korisnički portal — njihovi podaci se ne prikazuju.
    where: { ownerOrgId, status: "ACTIVE", hiddenByVendorAt: null, company: { plan: { not: "START" } } },
    select: {
      id: true,
      companyId: true,
      customerId: true,
      company: { select: { name: true } },
      customer: { select: { name: true, shortName: true } },
    },
    orderBy: { acceptedAt: "asc" },
  });
  return links.map((l) => ({
    linkId: l.id,
    companyId: l.companyId,
    customerId: l.customerId,
    companyName: l.company.name,
    customerName: l.customer.shortName ?? l.customer.name,
  }));
}

export type OwnerExtinguisher = {
  id: string;
  internalCode: string;
  serialNumber: string;
  productionYear: number;
  typeCode: string | null;
  manufacturerName: string;
  status: string;
  nextPeriodicDue: Date | null;
  lastPeriodicAt: Date | null;
  currentLabel: string | null;
  servicerName: string;
  companyId: string;
  departmentName: string | null;
};

function manufacturerLabel(m: { name: string; displayName: string | null }): string {
  const d = m.displayName?.trim();
  return d && d.length > 0 ? d : m.name;
}

export async function getOwnerExtinguishers(links: OwnerLinkInfo[]): Promise<OwnerExtinguisher[]> {
  const out: OwnerExtinguisher[] = [];

  for (const link of links) {
    // Stavke naloga ovog kupca → posljednje viđeno odjeljenje i naljepnica po aparatu (latest-first).
    const items = await prisma.workOrderItem.findMany({
      where: { companyId: link.companyId, workOrder: { customerId: link.customerId } },
      select: {
        extinguisherId: true,
        labelNumber: true,
        workOrder: { select: { receivedAt: true, department: { select: { name: true } } } },
      },
      orderBy: { workOrder: { receivedAt: "desc" } },
      take: 5000,
    });

    const deptByExt = new Map<string, string | null>();
    const labelByExt = new Map<string, string | null>();
    for (const it of items) {
      if (!it.extinguisherId) continue;
      if (!deptByExt.has(it.extinguisherId)) {
        deptByExt.set(it.extinguisherId, it.workOrder?.department?.name ?? null);
      }
      // Prva neprazna naljepnica (najnoviji nalog prvi) = trenutna naljepnica.
      if (!labelByExt.get(it.extinguisherId) && it.labelNumber) {
        labelByExt.set(it.extinguisherId, it.labelNumber);
      }
    }

    const extIds = [...deptByExt.keys()];
    if (extIds.length === 0) continue;

    const exts = await prisma.extinguisher.findMany({
      where: { id: { in: extIds }, companyId: link.companyId, deletedAt: null },
      orderBy: [{ nextPeriodicDue: "asc" }, { internalCode: "asc" }],
      include: {
        manufacturer: { select: { name: true, displayName: true } },
        type: { select: { code: true } },
      },
      take: 2000,
    });

    for (const e of exts) {
      out.push({
        id: e.id,
        internalCode: e.internalCode,
        serialNumber: e.serialNumber,
        productionYear: e.productionYear,
        typeCode: e.type?.code ?? null,
        manufacturerName: manufacturerLabel(e.manufacturer),
        status: e.status,
        nextPeriodicDue: e.nextPeriodicDue,
        lastPeriodicAt: e.lastPeriodicAt,
        currentLabel: labelByExt.get(e.id) ?? null,
        servicerName: link.companyName,
        companyId: link.companyId,
        departmentName: deptByExt.get(e.id) ?? null,
      });
    }
  }

  return out;
}

export type OwnerWorkOrder = {
  id: string;
  companyId: string;
  orderNumber: string;
  servicerName: string;
  departmentName: string | null;
  receivedAt: Date;
  finishedAt: Date | null;
  locked: boolean;
  itemsTotal: number;
  itemsServiced: number;
  deliveryNote: { id: string; number: string } | null;
  /// Samo IZDAN račun sa spremljenim PDF-om (koncepti se ne prikazuju kupcu).
  invoice: { id: string; number: string | null } | null;
};

export async function getOwnerWorkOrders(links: OwnerLinkInfo[], take = 50): Promise<OwnerWorkOrder[]> {
  if (links.length === 0) return [];
  const byCompany = new Map<string, string[]>();
  for (const l of links) {
    const arr = byCompany.get(l.companyId) ?? [];
    arr.push(l.customerId);
    byCompany.set(l.companyId, arr);
  }
  const nameByCompany = new Map(links.map((l) => [l.companyId, l.companyName]));

  const orders = await prisma.workOrder.findMany({
    where: {
      OR: [...byCompany.entries()].map(([companyId, customerIds]) => ({
        companyId,
        customerId: { in: customerIds },
      })),
    },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      companyId: true,
      orderNumber: true,
      receivedAt: true,
      finishedAt: true,
      status: true,
      department: { select: { name: true } },
      items: { select: { id: true, servicedAt: true } },
      deliveryNotes: {
        where: { supersededAt: null, pdfStoragePath: { not: null } },
        select: { id: true, number: true },
        orderBy: { issuedAt: "desc" },
        take: 1,
      },
      eracuniInvoice: { select: { id: true, number: true, status: true, pdfStoragePath: true } },
    },
    take,
  });

  return orders.map((o) => ({
    id: o.id,
    companyId: o.companyId,
    orderNumber: o.orderNumber,
    servicerName: nameByCompany.get(o.companyId) ?? "—",
    departmentName: o.department?.name ?? null,
    receivedAt: o.receivedAt,
    finishedAt: o.finishedAt,
    locked: o.status === "LOCKED",
    itemsTotal: o.items.length,
    itemsServiced: o.items.filter((i) => i.servicedAt).length,
    deliveryNote: o.deliveryNotes[0] ?? null,
    invoice:
      o.eracuniInvoice?.status === "ISSUED" && o.eracuniInvoice.pdfStoragePath
        ? { id: o.eracuniInvoice.id, number: o.eracuniInvoice.number }
        : null,
  }));
}

export type OwnerDeliveryNote = {
  id: string;
  number: string;
  issuedAt: Date;
  servicerName: string;
  orderNumber: string;
};

export async function getOwnerDeliveryNotes(links: OwnerLinkInfo[], take = 100): Promise<OwnerDeliveryNote[]> {
  if (links.length === 0) return [];
  const byCompany = new Map<string, string[]>();
  for (const l of links) {
    const arr = byCompany.get(l.companyId) ?? [];
    arr.push(l.customerId);
    byCompany.set(l.companyId, arr);
  }
  const nameByCompany = new Map(links.map((l) => [l.companyId, l.companyName]));

  const notes = await prisma.deliveryNote.findMany({
    where: {
      supersededAt: null,
      pdfStoragePath: { not: null },
      OR: [...byCompany.entries()].map(([companyId, customerIds]) => ({
        companyId,
        workOrder: { customerId: { in: customerIds } },
      })),
    },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      number: true,
      issuedAt: true,
      companyId: true,
      workOrder: { select: { orderNumber: true } },
    },
    take,
  });

  return notes.map((n) => ({
    id: n.id,
    number: n.number,
    issuedAt: n.issuedAt,
    servicerName: nameByCompany.get(n.companyId) ?? "—",
    orderNumber: n.workOrder.orderNumber,
  }));
}

/** Provjeri da org ima ACTIVE (nesakrivenu) vezu s kupcem ovog naloga. */
export async function ownerCanAccessWorkOrder(ownerOrgId: string | null, workOrderId: string): Promise<boolean> {
  if (!ownerOrgId) return false;
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { companyId: true, customerId: true },
  });
  if (!order) return false;
  const link = await prisma.ownerCustomerLink.findFirst({
    where: {
      ownerOrgId,
      status: "ACTIVE",
      hiddenByVendorAt: null,
      companyId: order.companyId,
      customerId: order.customerId,
      company: { plan: { not: "START" } },
    },
    select: { id: true },
  });
  return !!link;
}

/** Provjeri da org ima ACTIVE (nesakrivenu) vezu s kupcem ove otpremnice. */
export async function ownerCanAccessDeliveryNote(ownerOrgId: string | null, deliveryNoteId: string): Promise<{ companyId: string; pdfStoragePath: string } | null> {
  if (!ownerOrgId) return null;
  const note = await prisma.deliveryNote.findUnique({
    where: { id: deliveryNoteId },
    select: { companyId: true, pdfStoragePath: true, workOrder: { select: { customerId: true } } },
  });
  if (!note?.pdfStoragePath) return null;

  const link = await prisma.ownerCustomerLink.findFirst({
    where: {
      ownerOrgId,
      status: "ACTIVE",
      hiddenByVendorAt: null,
      companyId: note.companyId,
      customerId: note.workOrder.customerId,
      company: { plan: { not: "START" } },
    },
    select: { id: true },
  });
  if (!link) return null;
  return { companyId: note.companyId, pdfStoragePath: note.pdfStoragePath };
}
