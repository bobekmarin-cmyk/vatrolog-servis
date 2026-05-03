import type { ReceiptDeliveryMode, ServiceLocationKind } from "@prisma/client";

/**
 * Tekst za način servisa na radnom nalogu (UI + PDF).
 * Vozilo = uvijek na lokaciji kupca; stacionarni = kupac vs serviser; legacy ako nema podataka.
 */
export function describeWorkOrderServiceContext(args: {
  deliveryMode: ReceiptDeliveryMode | null;
  serviceLocationKind: ServiceLocationKind | null | undefined;
}): string {
  if (args.serviceLocationKind === "VEHICLE") {
    return "Servis u vozilu na lokaciji kupca";
  }
  if (args.serviceLocationKind === "STATIONARY") {
    if (args.deliveryMode === "SERVISER") return "Preuzima serviser";
    if (args.deliveryMode === "CUSTOMER") return "Dostavlja kupac";
    return "—";
  }
  // Stari zapisi bez lokacije
  if (!args.deliveryMode) return "—";
  return args.deliveryMode === "SERVISER" ? "Preuzima serviser" : "Dostavlja kupac";
}
