import type { PrismaClient } from "@prisma/client";
import { logWarn } from "@/lib/logger";

/**
 * Za zadani radni nalog (LOCK), dekrementira PartStock za svaku upotrebu
 * dijela (WorkOrderItemPart) unutar naloga. Ako zapis PartStock ne postoji,
 * stvara ga s negativnim stockom (tako da se vidi u warehouseu da se
 * nepraćeni dio koristi).
 *
 * Radi unutar zadane Prisma transakcije.
 */
export async function decrementStockForWorkOrder(
  tx: PrismaClient | Parameters<PrismaClient["$transaction"]>[0] extends (arg: infer T) => unknown ? T : never,
  params: { companyId: string; workOrderId: string },
): Promise<{ decremented: number; lowStock: Array<{ partId: string; stockQty: number; minStockQty: number }> }> {
  const client = tx as PrismaClient;
  const parts = await client.workOrderItemPart.findMany({
    where: { companyId: params.companyId, workOrderItem: { workOrderId: params.workOrderId } },
    select: { partId: true, quantity: true },
  });

  const totalByPart = new Map<string, number>();
  for (const p of parts) {
    totalByPart.set(p.partId, (totalByPart.get(p.partId) ?? 0) + (p.quantity ?? 1));
  }

  const lowStock: Array<{ partId: string; stockQty: number; minStockQty: number }> = [];
  let decremented = 0;
  for (const [partId, qty] of totalByPart) {
    const existing = await client.partStock.findUnique({
      where: { companyId_partId: { companyId: params.companyId, partId } },
    });
    if (existing) {
      const newQty = existing.stockQty - qty;
      await client.partStock.update({
        where: { id: existing.id },
        data: { stockQty: newQty },
      });
      decremented++;
      if (newQty <= existing.minStockQty) {
        lowStock.push({ partId, stockQty: newQty, minStockQty: existing.minStockQty });
      }
    } else {
      // Dio se koristi a nije u warehouseu → stvorimo zapis s negativnim stockom.
      try {
        await client.partStock.create({
          data: {
            companyId: params.companyId,
            partId,
            stockQty: -qty,
            minStockQty: 0,
          },
        });
        decremented++;
        lowStock.push({ partId, stockQty: -qty, minStockQty: 0 });
      } catch (err) {
        logWarn("part_stock_create_failed", { partId, companyId: params.companyId, err: String(err) });
      }
    }
  }

  return { decremented, lowStock };
}

/**
 * Suprotna operacija od `decrementStockForWorkOrder`.
 * Koristi se kod otključavanja naloga kako bi stanje skladišta ostalo simetrično:
 * lock troši dijelove, unlock vraća iste količine.
 */
export async function restoreStockForWorkOrder(
  tx: PrismaClient | Parameters<PrismaClient["$transaction"]>[0] extends (arg: infer T) => unknown ? T : never,
  params: { companyId: string; workOrderId: string },
): Promise<{ restored: number }> {
  const client = tx as PrismaClient;
  const parts = await client.workOrderItemPart.findMany({
    where: { companyId: params.companyId, workOrderItem: { workOrderId: params.workOrderId } },
    select: { partId: true, quantity: true },
  });

  const totalByPart = new Map<string, number>();
  for (const p of parts) {
    totalByPart.set(p.partId, (totalByPart.get(p.partId) ?? 0) + (p.quantity ?? 1));
  }

  let restored = 0;
  for (const [partId, qty] of totalByPart) {
    const existing = await client.partStock.findUnique({
      where: { companyId_partId: { companyId: params.companyId, partId } },
    });

    if (existing) {
      await client.partStock.update({
        where: { id: existing.id },
        data: { stockQty: existing.stockQty + qty },
      });
    } else {
      await client.partStock.create({
        data: {
          companyId: params.companyId,
          partId,
          stockQty: qty,
          minStockQty: 0,
        },
      });
    }
    restored++;
  }

  return { restored };
}
