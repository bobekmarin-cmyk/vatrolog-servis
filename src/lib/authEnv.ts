/**
 * Samo čitanje env varijabli (bez Prisma) — sigurno za middleware (Edge).
 */

export function resolvePlatformJwtSecret(): string | null {
  const s = process.env.PLATFORM_AUTH_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

export function resolveAuthJwtSecret(): string | null {
  const s = process.env.AUTH_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

/**
 * Secret za korisnički portal (Owner sesije). Zaseban `OWNER_AUTH_SECRET` ako je
 * postavljen, inače fallback na `AUTH_SECRET` (cookie + payload su ionako
 * namespace-ani pa nema miješanja s tenant/platform sesijama).
 */
export function resolveOwnerJwtSecret(): string | null {
  const s = process.env.OWNER_AUTH_SECRET?.trim();
  if (s && s.length > 0) return s;
  return resolveAuthJwtSecret();
}
