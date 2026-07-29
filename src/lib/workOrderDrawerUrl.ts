/**
 * Drži `?item=&mode=` u adresnoj traci u skladu s otvorenim drawerom naloga
 * (dijele ga drawer za aparat i drawer za servis) bez izazivanja navigacije.
 */
export function syncWorkOrderDrawerUrl(itemId: string | null, mode: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (itemId && mode) {
    url.searchParams.set("item", itemId);
    url.searchParams.set("mode", mode);
  } else {
    url.searchParams.delete("item");
    url.searchParams.delete("mode");
  }
  window.history.replaceState(window.history.state, "", url.toString());
}
