import { prisma } from "@/lib/prisma";
import { restoreStockForWorkOrder } from "@/lib/partStock";
import { revertLabelConsumptionOnUnlock } from "@/lib/serviceLabels";

/**
 * Tenant otključavanje zaključanog naloga: vraća status u IN_PROGRESS te
 * stornira potrošnju naljepnica i skidanje dijelova sa skladišta (simetrično
 * zaključavanju).
 */
export async function unlockWorkOrderCore(companyId: string, workOrderId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: "IN_PROGRESS",
        lockedAt: null,
        lockedById: null,
        finishedAt: null,
      },
    });
    const labelResult = await revertLabelConsumptionOnUnlock(
      tx as unknown as Parameters<typeof revertLabelConsumptionOnUnlock>[0],
      { companyId, workOrderId },
    );
    const stockResult = await restoreStockForWorkOrder(
      tx as unknown as Parameters<typeof restoreStockForWorkOrder>[0],
      { companyId, workOrderId },
    );
    return { labelResult, stockResult };
  });
}

/**
 * Vendor (platforma) otključavanje: SAMO otključa nalog, bez storniranja
 * naljepnica i skladišta — korisnik nešto doradi i ponovo zaključa.
 * Ponovno zaključavanje obračunava samo razliku (lock je diff-safe: prvo
 * vrati prethodnu snapshot potrošnju, pa skine novu).
 */
export async function unlockWorkOrderStatusOnly(workOrderId: string) {
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: "IN_PROGRESS",
      lockedAt: null,
      lockedById: null,
    },
  });
}

/**
 * Postoji li za nalog račun u e-računima (koncept ili izdan)? Takav nalog
 * tenant (admin/workshop) više ne smije otključati — samo vendor iznimno.
 */
export async function hasBlockingInvoice(workOrderId: string): Promise<boolean> {
  const invoice = await prisma.workOrderInvoice.findUnique({
    where: { workOrderId },
    select: { status: true },
  });
  return !!invoice && invoice.status !== "ERROR";
}
