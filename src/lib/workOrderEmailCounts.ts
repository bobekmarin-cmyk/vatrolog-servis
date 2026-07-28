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
    // Primka: zbroj redaka u tablici (identificirani + placeholderi) —
    // isto kao buildPrimkaReceiptLines / PrimkaPdfDocument.
    return prisma.workOrderItem.count({
      where: { workOrderId, companyId },
    });
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
