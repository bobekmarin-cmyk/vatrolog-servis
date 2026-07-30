/**
 * Stabilan redoslijed stavki na radnom nalogu.
 *
 * Ne sortiramo po `isPlaceholder` ni `servicedAt` — kad se placeholder popuni,
 * stavka mora ostati na istoj poziciji (isti R.br.) kao pri kreiranju.
 * Primka i upisnik koriste isti redoslijed / iste brojeve.
 */
export const WORK_ORDER_ITEM_ORDER_BY = [
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

/** 1-based R.br. u punom popisu stavki (uključujući placeholdere). */
export function workOrderItemRbr(indexInFullList: number): number {
  return indexInFullList + 1;
}
