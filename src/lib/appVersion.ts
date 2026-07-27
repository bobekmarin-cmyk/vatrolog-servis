/**
 * Semver (MAJOR.MINOR.PATCH), prikaz u shellu i PDF podnožju.
 *
 * • Prije git pusha na main/produkciju pokreni: `npm run version:bump`
 *   (povećava PATCH). Za veće releaseove ručno uredi ovu konstantu.
 */
export const APP_VERSION = "1.1.0";
export const APP_NAME = "VatroLog";

/** Posljednji fallback za produkciju — nikad localhost u mail linkovima. */
const PRODUCTION_FALLBACK_URL = "https://vatrolog.com";

function ensureAbsoluteHttpUrl(raw: string): string {
  const noTrail = raw.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(noTrail)) return noTrail;
  const hostish = noTrail.split("/")[0] ?? noTrail;
  const isLocal =
    /^localhost(?::\d+)?$/i.test(hostish) || /^127\.(?:\d{1,3}\.){2}\d{1,3}(?::\d+)?$/i.test(hostish);
  return `${isLocal ? "http" : "https"}://${noTrail}`;
}

function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

/**
 * Javni base URL aplikacije za mail linkove, metadata i server-side URL-ove.
 *
 * NE koristi `req.url` / `new URL(req.url).origin` — na Railway/proxyju to je
 * interni `http://localhost:8080` i završi u mailovima.
 *
 * Redoslijed: APP_BASE_URL → NEXT_PUBLIC_APP_URL → Vercel/Railway →
 * u produkciji vatrolog.com (nikad localhost).
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return ensureAbsoluteHttpUrl(explicit);

  const pub = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (pub) return ensureAbsoluteHttpUrl(pub);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//i, "")}`.replace(/\/$/, "");

  const railway =
    process.env.RAILWAY_PUBLIC_DOMAIN?.trim() ||
    process.env.RAILWAY_STATIC_URL?.trim();
  if (railway) return ensureAbsoluteHttpUrl(railway);

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_FALLBACK_URL;
  }
  return "http://localhost:3000";
}

/**
 * Javni URL (OAuth redirect, klijent). Prvo NEXT_PUBLIC_APP_URL, inače isto kao getAppBaseUrl.
 * U produkciji odbija localhost rezultat.
 */
export function getPublicAppUrl(): string {
  const pub = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (pub) {
    const url = ensureAbsoluteHttpUrl(pub);
    if (process.env.NODE_ENV === "production" && isLocalhostUrl(url)) {
      return getAppBaseUrl();
    }
    return url;
  }
  return getAppBaseUrl();
}
