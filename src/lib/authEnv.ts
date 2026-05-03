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
