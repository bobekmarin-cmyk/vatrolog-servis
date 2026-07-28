import { prisma } from "@/lib/prisma";

/**
 * Broj aparata za {broj} u mail predlošcima radnog naloga.
 * Mora biti usklađen s PDF-om (Primka / Upisnik / Otpremnica).
 */
export async function countWorkOrderItemsForEmailDoc(
  companyId: string,
  workOrderId: string,
  kind: "primka" | "register" | "delivery-note",
): Promise<number> {
  if (kind === "primka") {
    // Kao PrimkaPdfDocument: receivedQty (inicijalni primitak) + naknadne
    // dostave (stavke koje nisu iz početne primke). Placeholderi se broje —
    // primka se često šalje prije identifikacije aparata.
    const order = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId },
      select: {
        receivedQty: true,
        _count: { select: { items: { where: { fromInitialReceipt: false } } } },
      },
    });
    if (!order) return 0;
    return Math.max(0, order.receivedQty) + order._count.items;
  }

  if (kind === "register") {
    // Kao buildRegisterPdf: identificirani aparati (bez filtera periodicDone).
    return prisma.workOrderItem.count({
      where: {
        workOrderId,
        companyId,
        isPlaceholder: false,
        extinguisherId: { not: null },
      },
    });
  }

  // Otpremnica — šalje se tek nakon LOCKED; tada su placeholderi očišćeni.
  return prisma.workOrderItem.count({
    where: {
      workOrderId,
      companyId,
      isPlaceholder: false,
      extinguisherId: { not: null },
    },
  });
}
