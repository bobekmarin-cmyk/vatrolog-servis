/**
 * Semver (MAJOR.MINOR.PATCH), prikaz u shellu i PDF podnožju.
 *
 * • Prije git pusha na main/produkciju pokreni: `npm run version:bump`
 *   (povećava PATCH). Za veće releaseove ručno uredi ovu konstantu.
 */
export const APP_VERSION = "1.0.4";
export const APP_NAME = "VatroLog";

function ensureAbsoluteHttpUrl(raw: string): string {
  const noTrail = raw.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(noTrail)) return noTrail;
  const hostish = noTrail.split("/")[0] ?? noTrail;
  const isLocal =
    /^localhost(?::\d+)?$/i.test(hostish) || /^127\.(?:\d{1,3}\.){2}\d{1,3}(?::\d+)?$/i.test(hostish);
  return `${isLocal ? "http" : "https"}://${noTrail}`;
}

/** URL prikladan za new URL() / metadataBase — uvijek s shemom (https ili http). */
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return ensureAbsoluteHttpUrl(explicit);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");
  return "http://localhost:3000";
}

/**
 * Javni URL (OAuth redirect, klijent). Prvo NEXT_PUBLIC_APP_URL, inače isto kao getAppBaseUrl.
 */
export function getPublicAppUrl(): string {
  const pub = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (pub) return ensureAbsoluteHttpUrl(pub);
  return getAppBaseUrl();
}
