/**
 * Broj stavki na nalogu ne smije pasti ispod količine zabilježene na primci
 * (`WorkOrder.receivedQty`) — primka i tablica naloga moraju ostati usklađene.
 * Naknadno dodani placeholderi/aparati iznad te količine smiju se brisati.
 */
export function receiptFloorBlocksDelete(args: {
  itemCount: number;
  receivedQty: number;
}): boolean {
  const received = Math.max(0, Math.floor(args.receivedQty || 0));
  if (received <= 0) return false;
  return args.itemCount - 1 < received;
}

export function receiptFloorMessage(receivedQty: number): string {
  return `Ne može se obrisati — količina mora ostati usklađena s primkom (primljeno ${Math.max(
    0,
    Math.floor(receivedQty || 0),
  )}).`;
}
