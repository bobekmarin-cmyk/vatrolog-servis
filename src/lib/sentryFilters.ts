/**
 * Zajednički filtri za Sentry (server, edge i preglednik).
 *
 * Cilj je da u Sentryju ostane samo ono na što se može djelovati. Bez ovoga
 * popis zatrpaju greške iz korisnikovih proširenja preglednika, prekinuti
 * zahtjevi kod gubitka mreže i Next.js-ova interna kontrola toka — pa se prave
 * greške izgube u šumu.
 *
 * Ovaj modul NE smije importati ništa serversko: koristi ga i klijentski bundle.
 */

/** Podudaranje je po podnizu ili regexu nad porukom greške. */
export const SENTRY_IGNORE_ERRORS: (string | RegExp)[] = [
  // Proširenja preglednika (Adobe Acrobat, prevoditelji, password manageri…).
  "A listener indicated an asynchronous response by returning true",
  "Extension context invalidated",
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "ResizeObserver loop completed with undelivered notifications",
  "ResizeObserver loop limit exceeded",

  // Korisnik je zatvorio karticu ili izgubio mrežu usred zahtjeva.
  "Failed to fetch",
  "NetworkError when attempting to fetch resource",
  "Load failed",
  "The operation was aborted",
  "AbortError",
  "The user aborted a request",

  // Next.js kontrola toka: `redirect()` i `notFound()` rade tako da bacaju.
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",

  // Prekid navigacije kad korisnik brzo klikne dalje.
  "Navigation cancelled",
  "Abort route change",
];

/** Skripte izvan naše aplikacije — sve što dolazi odavde nije naš kod. */
export const SENTRY_DENY_URLS: RegExp[] = [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-(web-)?extension:\/\//i,
  /extensions\//i,
];

function messageOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "object") {
    const v = value as { message?: unknown; digest?: unknown };
    return [v.message, v.digest].filter((x) => typeof x === "string").join(" ");
  }
  return "";
}

/**
 * Dodatna provjera koju `ignoreErrors` ne pokriva: Next.js kontrolne iznimke
 * nose oznaku u `digest`, a ne u poruci.
 */
export function isNonActionableError(error: unknown): boolean {
  const text = messageOf(error);
  if (!text) return false;
  return (
    text.includes("NEXT_REDIRECT") ||
    text.includes("NEXT_NOT_FOUND") ||
    text.includes("DYNAMIC_SERVER_USAGE")
  );
}
