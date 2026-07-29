import type { ServiceFormCatalogPayload } from "@/lib/serviceFormData";

/**
 * Katalozi „Dodaj dio” / „Dodaj uslugu” dohvaćaju se tek na otvaranje izbornika
 * i dijele se između stavki istog naloga s istim aparatom (proizvođač + tip).
 */
const catalogCache = new Map<string, Promise<ServiceFormCatalogPayload>>();

export function fetchServiceFormCatalog(args: {
  orderId: string;
  itemId: string;
  catalogKey: string;
}): Promise<ServiceFormCatalogPayload> {
  const key = `${args.orderId}|${args.catalogKey}`;
  const cached = catalogCache.get(key);
  if (cached) return cached;

  const request = (async (): Promise<ServiceFormCatalogPayload> => {
    const res = await fetch(
      `/api/work-orders/${args.orderId}/items/${args.itemId}/service-form/catalog`,
      { cache: "no-store" },
    );
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; data?: ServiceFormCatalogPayload; error?: string }
      | null;
    if (!res.ok || !json?.ok || !json.data) {
      throw new Error(json?.error ?? "Katalog nije dostupan.");
    }
    return json.data;
  })();

  catalogCache.set(key, request);
  void request.catch(() => {
    if (catalogCache.get(key) === request) catalogCache.delete(key);
  });
  return request;
}
