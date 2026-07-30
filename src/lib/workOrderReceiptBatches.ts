/**
 * Količine aparata po datumima na radnom nalogu.
 * Izvor istine za retke primke i za floor brisanja stavki (`receivedQty` = zbroj).
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { calendarDayKeyEuropeZagreb, formatDayKeyDdMmYyyy } from "@/lib/primkaDeliveryLines";

type Db = PrismaClient | Prisma.TransactionClient;

export type ReceiptBatchRow = {
  id: string;
  receivedAt: Date;
  qty: number;
  isInitial: boolean;
};

/** Lokalni podne za kalendarski dan (YYYY-MM-DD) — stabilno za prikaz. */
export function noonFromDayKey(dayKey: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim());
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

export function dayKeyFromDate(d: Date): string {
  return calendarDayKeyEuropeZagreb(d);
}

export function receiptBatchesContentKey(
  batches: Array<{ receivedAt: Date; qty: number }>,
): string {
  return [...batches]
    .map((b) => ({ day: dayKeyFromDate(b.receivedAt), qty: Math.max(0, Math.floor(b.qty || 0)) }))
    .filter((b) => b.qty > 0)
    .sort((a, b) => a.day.localeCompare(b.day) || a.qty - b.qty)
    .map((b) => `${b.day}:${b.qty}`)
    .join("|");
}

export async function listReceiptBatches(db: Db, workOrderId: string): Promise<ReceiptBatchRow[]> {
  return db.workOrderReceiptBatch.findMany({
    where: { workOrderId },
    orderBy: [{ isInitial: "desc" }, { receivedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, receivedAt: true, qty: true, isInitial: true },
  });
}

export async function syncReceivedQtyFromBatches(
  db: Db,
  workOrderId: string,
): Promise<number> {
  const ag = await db.workOrderReceiptBatch.aggregate({
    where: { workOrderId },
    _sum: { qty: true },
  });
  const total = Math.max(0, ag._sum.qty ?? 0);
  await db.workOrder.update({
    where: { id: workOrderId },
    data: { receivedQty: total },
  });
  return total;
}

/** Osiguraj početni batch za nalog (idempotentno). */
export async function ensureInitialReceiptBatch(
  db: Db,
  args: {
    companyId: string;
    workOrderId: string;
    receivedAt: Date;
    qty: number;
  },
): Promise<void> {
  const qty = Math.max(0, Math.floor(args.qty || 0));
  if (qty < 1) return;

  const existing = await db.workOrderReceiptBatch.findFirst({
    where: { workOrderId: args.workOrderId, isInitial: true },
    select: { id: true },
  });
  if (existing) return;

  await db.workOrderReceiptBatch.create({
    data: {
      companyId: args.companyId,
      workOrderId: args.workOrderId,
      receivedAt: noonFromDayKey(dayKeyFromDate(args.receivedAt)),
      qty,
      isInitial: true,
    },
  });
}

/**
 * Dodaj količinu na dan (merge ako batch za taj dan već postoji).
 * Ne dira isInitial flag postojećeg batcha.
 */
export async function addQtyToReceiptBatchDay(
  db: Db,
  args: {
    companyId: string;
    workOrderId: string;
    receivedAt: Date;
    qty: number;
  },
): Promise<{ batchId: string; qty: number }> {
  const add = Math.max(0, Math.floor(args.qty || 0));
  if (add < 1) throw new Error("QTY_INVALID");

  const dayKey = dayKeyFromDate(args.receivedAt);
  const noon = noonFromDayKey(dayKey);

  const batches = await db.workOrderReceiptBatch.findMany({
    where: { workOrderId: args.workOrderId },
    select: { id: true, receivedAt: true, qty: true },
  });
  const sameDay = batches.find((b) => dayKeyFromDate(b.receivedAt) === dayKey);

  if (sameDay) {
    const updated = await db.workOrderReceiptBatch.update({
      where: { id: sameDay.id },
      data: { qty: sameDay.qty + add },
      select: { id: true, qty: true },
    });
    await syncReceivedQtyFromBatches(db, args.workOrderId);
    return { batchId: updated.id, qty: updated.qty };
  }

  const hasAny = batches.length > 0;
  const hasInitial = await db.workOrderReceiptBatch.findFirst({
    where: { workOrderId: args.workOrderId, isInitial: true },
    select: { id: true },
  });

  const created = await db.workOrderReceiptBatch.create({
    data: {
      companyId: args.companyId,
      workOrderId: args.workOrderId,
      receivedAt: noon,
      qty: add,
      // Prvi ikad unos na nalogu = početni red (ako još nema isInitial).
      isInitial: !hasAny || !hasInitial,
    },
    select: { id: true, qty: true },
  });
  await syncReceivedQtyFromBatches(db, args.workOrderId);
  return { batchId: created.id, qty: created.qty };
}

export type BatchInput = {
  id?: string | null;
  /** ISO YYYY-MM-DD ili Date */
  receivedAt: string | Date;
  qty: number;
  isInitial?: boolean;
};

/**
 * Zamijeni sve batcheve (osim što mora ostati točno jedan isInitial).
 * Ukupan zbroj ne smije biti manji od `minTotal` (broj stavki na nalogu).
 */
export async function replaceReceiptBatches(
  db: Db,
  args: {
    companyId: string;
    workOrderId: string;
    batches: BatchInput[];
    minTotal: number;
  },
): Promise<ReceiptBatchRow[]> {
  const normalized = args.batches
    .map((b) => {
      const dayKey =
        typeof b.receivedAt === "string"
          ? b.receivedAt.includes("-")
            ? b.receivedAt.slice(0, 10)
            : dayKeyFromDate(new Date(b.receivedAt))
          : dayKeyFromDate(b.receivedAt);
      return {
        dayKey,
        qty: Math.max(0, Math.floor(Number(b.qty) || 0)),
        isInitial: !!b.isInitial,
      };
    })
    .filter((b) => b.qty > 0);

  if (normalized.length === 0) throw new Error("BATCHES_EMPTY");

  const initials = normalized.filter((b) => b.isInitial);
  if (initials.length !== 1) throw new Error("INITIAL_REQUIRED");

  // Merge same calendar day (keep isInitial if any)
  const byDay = new Map<string, { qty: number; isInitial: boolean }>();
  for (const b of normalized) {
    const prev = byDay.get(b.dayKey);
    if (!prev) {
      byDay.set(b.dayKey, { qty: b.qty, isInitial: b.isInitial });
    } else {
      byDay.set(b.dayKey, {
        qty: prev.qty + b.qty,
        isInitial: prev.isInitial || b.isInitial,
      });
    }
  }

  const merged = [...byDay.entries()].map(([dayKey, v]) => ({ dayKey, ...v }));
  const total = merged.reduce((s, b) => s + b.qty, 0);
  if (total < Math.max(0, args.minTotal)) {
    throw new Error("BELOW_ITEM_COUNT");
  }

  await db.workOrderReceiptBatch.deleteMany({ where: { workOrderId: args.workOrderId } });
  await db.workOrderReceiptBatch.createMany({
    data: merged.map((b) => ({
      companyId: args.companyId,
      workOrderId: args.workOrderId,
      receivedAt: noonFromDayKey(b.dayKey),
      qty: b.qty,
      isInitial: b.isInitial,
    })),
  });

  await syncReceivedQtyFromBatches(db, args.workOrderId);
  return listReceiptBatches(db, args.workOrderId);
}

export function formatBatchLabel(receivedAt: Date, qty: number, isInitial: boolean): string {
  const d = formatDayKeyDdMmYyyy(dayKeyFromDate(receivedAt));
  if (isInitial) return `${d} — ${qty} kom (početni unos)`;
  return `${d} — ${qty} kom`;
}

/**
 * Smanji zbroj batch-eva na najviše `maxTotal` (npr. nakon brisanja placeholdera pri zaključavanju).
 * Skida količinu s najnovijih ne-početnih unosa, zatim s početnog.
 */
export async function clampReceiptBatchesToMax(
  db: Db,
  workOrderId: string,
  maxTotal: number,
): Promise<number> {
  const cap = Math.max(0, Math.floor(maxTotal));
  const batches = await db.workOrderReceiptBatch.findMany({
    where: { workOrderId },
    orderBy: [{ isInitial: "asc" }, { receivedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, qty: true, isInitial: true },
  });
  const sum = batches.reduce((s, b) => s + b.qty, 0);
  if (sum <= cap) {
    return syncReceivedQtyFromBatches(db, workOrderId);
  }

  let excess = sum - cap;
  for (const b of batches) {
    if (excess <= 0) break;
    const cut = Math.min(b.qty, excess);
    const nextQty = b.qty - cut;
    excess -= cut;
    if (nextQty <= 0) {
      await db.workOrderReceiptBatch.delete({ where: { id: b.id } });
    } else {
      await db.workOrderReceiptBatch.update({
        where: { id: b.id },
        data: { qty: nextQty },
      });
    }
  }

  // Početni red mora ostati ako još ima količine — ako je obrisan a cap > 0, ostavi što je ostalo.
  const remaining = await db.workOrderReceiptBatch.findMany({
    where: { workOrderId },
    select: { id: true, isInitial: true },
  });
  if (remaining.length > 0 && !remaining.some((r) => r.isInitial)) {
    await db.workOrderReceiptBatch.update({
      where: { id: remaining[0]!.id },
      data: { isInitial: true },
    });
  }

  return syncReceivedQtyFromBatches(db, workOrderId);
}
