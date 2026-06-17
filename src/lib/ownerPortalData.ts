import { prisma } from "@/lib/prisma";

/**
 * Read-only agregacija podataka za Korisnički portal. Vlasnik vidi sve kupce
 * (po tvrtkama) s kojima ima ACTIVE vezu — aparate, naloge i otpremnice.
 */

export type OwnerLinkInfo = {
  linkId: string;
  companyId: string;
  customerId: string;
  companyName: string;
  customerName: string;
};

export async function getOwnerActiveLinks(ownerId: string): Promise<OwnerLinkInfo[]> {
  const links = await prisma.ownerCustomerLink.findMany({
    where: { ownerId, status: "ACTIVE" },
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
  typeCode: string | null;
  manufacturerName: string;
  status: string;
  nextPeriodicDue: Date | null;
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
    // Stavke naloga ovog kupca → posljednje viđeno odjeljenje po aparatu (latest-first).
    const items = await prisma.workOrderItem.findMany({
      where: { companyId: link.companyId, workOrder: { customerId: link.customerId } },
      select: {
        extinguisherId: true,
        workOrder: { select: { receivedAt: true, department: { select: { name: true } } } },
      },
      orderBy: { workOrder: { receivedAt: "desc" } },
      take: 5000,
    });

    const deptByExt = new Map<string, string | null>();
    for (const it of items) {
      if (!it.extinguisherId) continue;
      if (!deptByExt.has(it.extinguisherId)) {
        deptByExt.set(it.extinguisherId, it.workOrder?.department?.name ?? null);
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
        typeCode: e.type?.code ?? null,
        manufacturerName: manufacturerLabel(e.manufacturer),
        status: e.status,
        nextPeriodicDue: e.nextPeriodicDue,
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
  receivedAt: Date;
  finishedAt: Date | null;
  itemsTotal: number;
  itemsServiced: number;
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
      items: { select: { id: true, servicedAt: true } },
    },
    take,
  });

  return orders.map((o) => ({
    id: o.id,
    companyId: o.companyId,
    orderNumber: o.orderNumber,
    servicerName: nameByCompany.get(o.companyId) ?? "—",
    receivedAt: o.receivedAt,
    finishedAt: o.finishedAt,
    itemsTotal: o.items.length,
    itemsServiced: o.items.filter((i) => i.servicedAt).length,
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

/** Provjeri da prijavljeni vlasnik ima ACTIVE vezu s kupcem ove otpremnice. */
export async function ownerCanAccessDeliveryNote(ownerId: string, deliveryNoteId: string): Promise<{ companyId: string; pdfStoragePath: string } | null> {
  const note = await prisma.deliveryNote.findUnique({
    where: { id: deliveryNoteId },
    select: { companyId: true, pdfStoragePath: true, workOrder: { select: { customerId: true } } },
  });
  if (!note?.pdfStoragePath) return null;

  const link = await prisma.ownerCustomerLink.findFirst({
    where: { ownerId, status: "ACTIVE", companyId: note.companyId, customerId: note.workOrder.customerId },
    select: { id: true },
  });
  if (!link) return null;
  return { companyId: note.companyId, pdfStoragePath: note.pdfStoragePath };
}
