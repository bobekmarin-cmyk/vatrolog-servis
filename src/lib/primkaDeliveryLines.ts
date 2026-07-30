/**
 * Primka (radni nalog): retci primitka iz stvarnih stavki u tablici.
 *
 * - Ukupan zbroj po danima = broj stavki (aparati + placeholderi).
 * - Stavke iz početne primke (`fromInitialReceipt`) broje se na dan `receivedAt`.
 * - Naknadno dodane stavke broje se po danu `createdAt`.
 * - Ako je naknadna dostava isti kalendarski dan kao primitak → ulazi u
 *   jedan redak „primljeno N” (bez odvojenog „dodatna”).
 * - Tek drugi dan → zaseban redak „dostavljena N dodatna…”.
 */

export function calendarDayKeyEuropeZagreb(d: Date): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** dd.mm.yyyy. iz ISO datuma ključa YYYY-MM-DD */
export function formatDayKeyDdMmYyyy(dayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim());
  if (!m) return dayKey;
  return `${m[3]}.${m[2]}.${m[1]}.`;
}

/** Jedan redak primke za inicijalni/isti dan primitka, gramatika HR. */
export function formatInitialReceivedLine(dateLabelDdMmYyyy: string, count: number): string {
  if (count < 1) return "";
  const d = dateLabelDdMmYyyy.trim();
  if (count === 1) {
    return `${d} — Na servis je primljeno 1 vatrogasni aparat.`;
  }
  return `${d} — Na servis je primljeno ${count} vatrogasnih aparata.`;
}

/** Jedan redak primke za naknadno dostavljene aparate (drugi dan), gramatika HR. */
export function formatSubsequentPlaceholderLine(dateLabelDdMmYyyy: string, count: number): string {
  if (count < 1) return "";
  const d = dateLabelDdMmYyyy.trim();
  if (count === 1) {
    return `${d} — Na servis je dostavljen 1 dodatni vatrogasni aparat.`;
  }
  if (count >= 2 && count <= 4) {
    return `${d} — Na servis su dostavljena ${count} dodatna vatrogasna aparata.`;
  }
  return `${d} — Na servis je dostavljeno ${count} dodatnih vatrogasnih aparata.`;
}

export type ItemLike = {
  fromInitialReceipt: boolean;
  createdAt: Date;
};

export type PrimkaReceiptLines = {
  /** Broj stavki na dan primitka (0 ako nema nijedne na taj dan). */
  initialReceivedQty: number;
  /** Retci samo za dane različite od dana primitka. */
  subsequentDeliveryLines: string[];
  /** Svi retci za ispis (inicijalni + naknadni), zbroj countova = items.length. */
  allLines: string[];
};

/**
 * Izračun redaka primke iz live stavki naloga.
 * `receivedAt` = datum radnog naloga / primitka.
 */
export function buildPrimkaReceiptLines(items: ItemLike[], receivedAt: Date): PrimkaReceiptLines {
  const receiptDay = calendarDayKeyEuropeZagreb(receivedAt);
  const byDay = new Map<string, number>();

  for (const it of items) {
    const day = it.fromInitialReceipt
      ? receiptDay
      : calendarDayKeyEuropeZagreb(it.createdAt);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  return linesFromDayMap(byDay, receiptDay);
}

/**
 * Retci primke iz eksplicitnih batch unosa (preferirani izvor).
 * `initialDayKey` = dan početnog unosa (isInitial batch).
 */
export function buildPrimkaReceiptLinesFromBatches(
  batches: Array<{ receivedAt: Date; qty: number; isInitial?: boolean }>,
  fallbackReceivedAt?: Date,
): PrimkaReceiptLines {
  const byDay = new Map<string, number>();
  let initialDay =
    fallbackReceivedAt != null ? calendarDayKeyEuropeZagreb(fallbackReceivedAt) : null;

  for (const b of batches) {
    const qty = Math.max(0, Math.floor(b.qty || 0));
    if (qty < 1) continue;
    const day = calendarDayKeyEuropeZagreb(b.receivedAt);
    byDay.set(day, (byDay.get(day) ?? 0) + qty);
    if (b.isInitial) initialDay = day;
  }

  if (!initialDay) {
    const keys = [...byDay.keys()].sort();
    initialDay = keys[0] ?? calendarDayKeyEuropeZagreb(new Date());
  }

  return linesFromDayMap(byDay, initialDay);
}

function linesFromDayMap(byDay: Map<string, number>, receiptDay: string): PrimkaReceiptLines {
  const initialReceivedQty = byDay.get(receiptDay) ?? 0;
  const otherDays = [...byDay.keys()].filter((k) => k !== receiptDay).sort();

  const subsequentDeliveryLines = otherDays
    .map((key) =>
      formatSubsequentPlaceholderLine(formatDayKeyDdMmYyyy(key), byDay.get(key) ?? 0),
    )
    .filter(Boolean);

  const allLines: string[] = [];
  if (initialReceivedQty > 0) {
    allLines.push(formatInitialReceivedLine(formatDayKeyDdMmYyyy(receiptDay), initialReceivedQty));
  }
  allLines.push(...subsequentDeliveryLines);

  return { initialReceivedQty, subsequentDeliveryLines, allLines };
}

/** @deprecated Koristi buildPrimkaReceiptLines — zadržano radi eventualnih starih poziva. */
export function buildSubsequentDeliveryLinesByDay(
  items: Array<ItemLike & { isPlaceholder?: boolean }>,
  receivedAt?: Date,
): string[] {
  if (receivedAt) {
    return buildPrimkaReceiptLines(items, receivedAt).subsequentDeliveryLines;
  }
  // Legacy: samo placeholderi koji nisu iz početne primke, bez spajanja s danom primitka.
  const byDay = new Map<string, number>();
  for (const it of items) {
    if (it.fromInitialReceipt) continue;
    if ("isPlaceholder" in it && it.isPlaceholder === false) continue;
    const k = calendarDayKeyEuropeZagreb(it.createdAt);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  return [...byDay.keys()]
    .sort()
    .map((key) => formatSubsequentPlaceholderLine(formatDayKeyDdMmYyyy(key), byDay.get(key) ?? 0))
    .filter(Boolean);
}
