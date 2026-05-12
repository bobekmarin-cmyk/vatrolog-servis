/**
 * Primka (radni nalog): inicijalni primitak + naknadne dostave placeholdera po kalendarskom danu (Europe/Zagreb).
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

/** Jedan redak primke za naknadno dostavljene (još neidentificirane) aparate, gramatika HR. */
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
  isPlaceholder: boolean;
  fromInitialReceipt: boolean;
  createdAt: Date;
};

export function buildSubsequentDeliveryLinesByDay(items: ItemLike[]): string[] {
  const byDay = new Map<string, number>();
  for (const it of items) {
    if (!it.isPlaceholder || it.fromInitialReceipt) continue;
    const k = calendarDayKeyEuropeZagreb(it.createdAt);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const keys = [...byDay.keys()].sort();
  return keys.map((key) =>
    formatSubsequentPlaceholderLine(formatDayKeyDdMmYyyy(key), byDay.get(key) ?? 0),
  );
}
