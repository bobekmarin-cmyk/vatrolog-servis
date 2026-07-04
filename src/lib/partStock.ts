import type { PrismaClient } from "@prisma/client";
import { logWarn } from "@/lib/logger";

type Tx = PrismaClient | (Parameters<PrismaClient["$transaction"]>[0] extends (arg: infer T) => unknown ? T : never);

/**
 * Vrati na stanje sve što je po snapshotu (WorkOrderPartConsumption) ranije
 * skinuto za ovaj nalog i pobriši snapshot retke. No-op ako snapshota nema.
 */
async function restoreFromConsumptionSnapshot(
  client: PrismaClient,
  params: { companyId: string; workOrderId: string },
): Promise<{ restored: number }> {
  const rows = await client.workOrderPartConsumption.findMany({
    where: { workOrderId: params.workOrderId },
    select: { partId: true, quantity: true },
  });

  let restored = 0;
  for (const row of rows) {
    const existing = await client.partStock.findUnique({
      where: { companyId_partId: { companyId: params.companyId, partId: row.partId } },
    });
    if (existing) {
      await client.partStock.update({
        where: { id: existing.id },
        data: { stockQty: existing.stockQty + row.quantity },
      });
    } else {
      await client.partStock.create({
        data: {
          companyId: params.companyId,
          partId: row.partId,
          stockQty: row.quantity,
          minStockQty: 0,
        },
      });
    }
    restored++;
  }

  if (rows.length > 0) {
    await client.workOrderPartConsumption.deleteMany({
      where: { workOrderId: params.workOrderId },
    });
  }

  return { restored };
}

/**
 * Za zadani radni nalog (LOCK), dekrementira PartStock za svaku upotrebu
 * dijela (WorkOrderItemPart) unutar naloga i pohrani snapshot potrošnje
 * (WorkOrderPartConsumption). Ako zapis PartStock ne postoji, stvara ga s
 * negativnim stockom (tako da se vidi u warehouseu da se nepraćeni dio koristi).
 *
 * Idempotentno / diff-safe: ako od prethodnog zaključavanja postoji snapshot
 * potrošnje (npr. vendor je otključao nalog bez storniranja), prvo se stara
 * potrošnja vrati na stanje pa se obračuna nova — neto efekt je razlika.
 *
 * Radi unutar zadane Prisma transakcije.
 */
export async function decrementStockForWorkOrder(
  tx: Tx,
  params: { companyId: string; workOrderId: string },
): Promise<{ decremented: number; lowStock: Array<{ partId: string; stockQty: number; minStockQty: number }> }> {
  const client = tx as PrismaClient;

  await restoreFromConsumptionSnapshot(client, params);

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
    await client.workOrderPartConsumption.create({
      data: { workOrderId: params.workOrderId, partId, quantity: qty },
    });

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
 *
 * Vraća po snapshotu potrošnje (točno ono što je bilo skinuto). Fallback na
 * žive stavke postoji samo za povijesne naloge zaključane prije snapshota.
 */
export async function restoreStockForWorkOrder(
  tx: Tx,
  params: { companyId: string; workOrderId: string },
): Promise<{ restored: number }> {
  const client = tx as PrismaClient;

  const fromSnapshot = await restoreFromConsumptionSnapshot(client, params);
  if (fromSnapshot.restored > 0) return fromSnapshot;

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
