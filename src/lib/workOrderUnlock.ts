import { prisma } from "@/lib/prisma";
import { restoreStockForWorkOrder } from "@/lib/partStock";
import { revertLabelConsumptionOnUnlock } from "@/lib/serviceLabels";

/**
 * Zajednička logika otključavanja zaključanog naloga (tenant ruta i
 * platformski force-unlock): vraća status u IN_PROGRESS te stornira
 * potrošnju naljepnica i skidanje dijelova sa skladišta.
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
