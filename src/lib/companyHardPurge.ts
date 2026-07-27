import { prisma } from "@/lib/prisma";

export type HardPurgeResult = {
  companyId: string;
  companyName: string;
  oib: string;
  serviceCode: string;
  deletedOwnerOrgs: number;
  deletedOrphanOwners: number;
};

/**
 * Trajno briše tvrtku i sve tenant podatke.
 * Soft-delete NIJE dovoljan za čisti re-test — ovo radi hard DELETE.
 *
 * Redoslijed rješava Restrict FK-ove (stock receipts/adjustments → parts,
 * custom services na WO stavkama, label consumptions).
 * Nakon brisanja čisti OwnerOrg zapise koji više nemaju nijedan link.
 */
export async function hardPurgeCompany(companyId: string): Promise<HardPurgeResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, oib: true, serviceCode: true },
  });
  if (!company) {
    throw new Error("Tvrtka nije pronađena.");
  }

  const customerOibs = await prisma.customer.findMany({
    where: { companyId },
    select: { oib: true },
    distinct: ["oib"],
  });
  const oibs = customerOibs.map((c) => c.oib);

  await prisma.$transaction(
    async (tx) => {
      // 1) Stock: Restrict na Part — prvo stavke/primke/korekcije
      const receiptIds = (
        await tx.stockReceipt.findMany({
          where: { companyId },
          select: { id: true },
        })
      ).map((r) => r.id);
      if (receiptIds.length > 0) {
        await tx.stockReceiptItem.deleteMany({ where: { receiptId: { in: receiptIds } } });
        await tx.stockReceipt.deleteMany({ where: { id: { in: receiptIds } } });
      }
      await tx.stockAdjustment.deleteMany({ where: { companyId } });

      // 2) Label consumptions / receipts (Restrict na ServiceLabel)
      const workOrderIds = (
        await tx.workOrder.findMany({ where: { companyId }, select: { id: true } })
      ).map((w) => w.id);
      if (workOrderIds.length > 0) {
        await tx.workOrderLabelConsumption.deleteMany({
          where: { workOrderId: { in: workOrderIds } },
        });
        await tx.workOrderPartConsumption.deleteMany({
          where: { workOrderId: { in: workOrderIds } },
        });
      }

      const labelReceiptIds = (
        await tx.serviceLabelReceipt.findMany({
          where: { companyId },
          select: { id: true },
        })
      ).map((r) => r.id);
      if (labelReceiptIds.length > 0) {
        await tx.serviceLabelReceiptItem.deleteMany({
          where: { receiptId: { in: labelReceiptIds } },
        });
        await tx.serviceLabelReceipt.deleteMany({ where: { id: { in: labelReceiptIds } } });
      }
      await tx.serviceLabelAdjustment.deleteMany({ where: { companyId } });
      await tx.serviceLabelStock.deleteMany({ where: { companyId } });

      // 3) Custom services na nalozima (Restrict) — briši prije customServices cascada
      await tx.workOrderItemCustomService.deleteMany({ where: { companyId } });

      // 4) Company cascade radi ostatak
      await tx.company.delete({ where: { id: companyId } });
    },
    { timeout: 60_000 },
  );

  // 5) Orphan OwnerOrg (nema više nijedan OwnerCustomerLink)
  let deletedOwnerOrgs = 0;
  let deletedOrphanOwners = 0;
  if (oibs.length > 0) {
    const orgs = await prisma.ownerOrg.findMany({
      where: { oib: { in: oibs } },
      select: {
        id: true,
        _count: { select: { links: true } },
      },
    });
    const orphanOrgIds = orgs.filter((o) => o._count.links === 0).map((o) => o.id);
    if (orphanOrgIds.length > 0) {
      // Memberships cascade; Owners mogu ostati dijeljeni — briši samo one bez drugih membershipa
      const memberships = await prisma.ownerOrgMembership.findMany({
        where: { ownerOrgId: { in: orphanOrgIds } },
        select: { ownerId: true },
      });
      const ownerIds = Array.from(new Set(memberships.map((m) => m.ownerId)));

      await prisma.ownerOrg.deleteMany({ where: { id: { in: orphanOrgIds } } });
      deletedOwnerOrgs = orphanOrgIds.length;

      if (ownerIds.length > 0) {
        const stillLinked = await prisma.ownerOrgMembership.findMany({
          where: { ownerId: { in: ownerIds } },
          select: { ownerId: true },
        });
        const still = new Set(stillLinked.map((m) => m.ownerId));
        const orphanOwners = ownerIds.filter((id) => !still.has(id));
        if (orphanOwners.length > 0) {
          // AuthToken / OwnerCustomerLink ownerId SetNull već; briši Owner
          await prisma.owner.deleteMany({ where: { id: { in: orphanOwners } } });
          deletedOrphanOwners = orphanOwners.length;
        }
      }
    }
  }

  return {
    companyId: company.id,
    companyName: company.name,
    oib: company.oib,
    serviceCode: company.serviceCode,
    deletedOwnerOrgs,
    deletedOrphanOwners,
  };
}
