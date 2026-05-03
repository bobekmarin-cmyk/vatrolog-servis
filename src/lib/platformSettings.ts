import { prisma } from "@/lib/prisma";

export type ResolvedPlatformBranding = {
  fromName: string;
  fromEmail: string;
  signatureHtml: string | null;
  logoUrl: string | null;
  brandColor: string;
};

const DEFAULT_BRAND_COLOR = "#dc2626";
const DEFAULT_FROM_NAME = "VatroLog";

let cache: { value: ResolvedPlatformBranding; ts: number } | null = null;
const TTL_MS = 60_000;

export async function getPlatformSettings() {
  return prisma.platformSettings.findFirst();
}

export async function upsertPlatformSettings(data: {
  defaultFromName?: string | null;
  defaultFromEmail?: string | null;
  signatureHtml?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
}) {
  const existing = await prisma.platformSettings.findFirst();
  cache = null;
  if (existing) {
    return prisma.platformSettings.update({ where: { id: existing.id }, data });
  }
  return prisma.platformSettings.create({ data });
}

export async function resolveBranding(): Promise<ResolvedPlatformBranding> {
  const now = Date.now();
  if (cache && now - cache.ts < TTL_MS) return cache.value;

  const s = await prisma.platformSettings.findFirst();
  const integration = await prisma.platformIntegration.findUnique({ where: { provider: "GMAIL" } });

  const fromName =
    s?.defaultFromName?.trim() ||
    process.env.VENDOR_FROM_NAME?.trim() ||
    process.env.SMTP_FROM_NAME?.trim() ||
    DEFAULT_FROM_NAME;

  const fromEmail =
    s?.defaultFromEmail?.trim() ||
    process.env.VENDOR_FROM_EMAIL?.trim() ||
    integration?.email ||
    process.env.SMTP_FROM_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "no-reply@vatrolog.local";

  const value: ResolvedPlatformBranding = {
    fromName,
    fromEmail,
    signatureHtml: s?.signatureHtml ?? null,
    logoUrl: s?.logoUrl ?? null,
    brandColor: s?.brandColor?.trim() || DEFAULT_BRAND_COLOR,
  };
  cache = { value, ts: now };
  return value;
}

export function invalidateBrandingCache() {
  cache = null;
}
