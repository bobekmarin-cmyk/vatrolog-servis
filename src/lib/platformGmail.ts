/**
 * Vendor (platform) Gmail integracija.
 *
 * Koristi se za sistemske mailove (reset lozinke, pozivnice, verifikacije,
 * podsjetnici pretplate). Tokeni žive u `PlatformIntegration` (singleton po
 * provideru `GMAIL`), enkriptirani s `AUTH_SECRET` (AES-GCM).
 *
 * Per-tenant Gmail (slanje kupcima) ostaje u `Company.gmail*` i u
 * `src/app/api/gmail/**` rutama.
 */

import { getPublicAppUrl } from "@/lib/appVersion";
import { prisma } from "@/lib/prisma";
import {
  encryptToken,
  decryptToken,
  exchangeCode as exchangeCodeRaw,
  refreshAccessToken,
  fetchGmailEmail,
  revokeToken,
  sendGmail,
} from "@/lib/gmail";

const PROVIDER = "GMAIL";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const VENDOR_FROM_EMAIL = process.env.VENDOR_FROM_EMAIL?.trim() ?? "";
const VENDOR_FROM_NAME = process.env.VENDOR_FROM_NAME?.trim() ?? "VatroLog";

export type VendorGmailStatus = {
  connected: boolean;
  email: string | null;
  connectedAt: Date | null;
  expiresAt: Date | null;
  scope: string | null;
};

function appBaseUrl(): string {
  return getPublicAppUrl();
}

/**
 * Redirect URI za platform/vendor OAuth flow.
 * Različit od per-tenant `getRedirectUri()` u `src/lib/gmail.ts`.
 */
export function getPlatformRedirectUri(): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI_PLATFORM?.trim();
  if (explicit) return explicit;
  return `${appBaseUrl()}/api/platform/gmail/callback`;
}

export function buildPlatformConsentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getPlatformRedirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangePlatformCode(code: string) {
  // exchangeCodeRaw is hard-coded to tenant redirect URI; replicate with platform redirect.
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: getPlatformRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vendor token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
}

export async function getVendorIntegration() {
  return prisma.platformIntegration.findUnique({ where: { provider: PROVIDER } });
}

export async function isVendorConnected(): Promise<boolean> {
  const it = await getVendorIntegration();
  return !!it?.refreshTokenEnc && !!it?.email;
}

export async function getVendorStatus(): Promise<VendorGmailStatus> {
  const it = await getVendorIntegration();
  return {
    connected: !!it?.refreshTokenEnc && !!it?.email,
    email: it?.email ?? null,
    connectedAt: it?.connectedAt ?? null,
    expiresAt: it?.expiresAt ?? null,
    scope: it?.scope ?? null,
  };
}

export async function saveVendorTokens(args: {
  email: string;
  accessToken: string;
  refreshToken?: string | null;
  scope?: string | null;
  expiresInSec?: number | null;
  connectedById?: string | null;
}) {
  const expiresAt = args.expiresInSec
    ? new Date(Date.now() + Math.max(60, args.expiresInSec - 30) * 1000)
    : null;

  await prisma.platformIntegration.upsert({
    where: { provider: PROVIDER },
    create: {
      provider: PROVIDER,
      email: args.email,
      accessTokenEnc: encryptToken(args.accessToken),
      refreshTokenEnc: args.refreshToken ? encryptToken(args.refreshToken) : null,
      scope: args.scope ?? null,
      expiresAt,
      connectedAt: new Date(),
      connectedById: args.connectedById ?? null,
    },
    update: {
      email: args.email,
      accessTokenEnc: encryptToken(args.accessToken),
      ...(args.refreshToken
        ? { refreshTokenEnc: encryptToken(args.refreshToken) }
        : {}),
      scope: args.scope ?? null,
      expiresAt,
      connectedAt: new Date(),
      ...(args.connectedById ? { connectedById: args.connectedById } : {}),
    },
  });
}

export async function ensureVendorAccessToken(): Promise<{
  accessToken: string;
  email: string;
}> {
  const it = await getVendorIntegration();
  if (!it?.refreshTokenEnc || !it?.email) {
    throw new Error("VENDOR_NOT_CONNECTED");
  }

  const expiresAt = it.expiresAt;
  const stillFresh = expiresAt && expiresAt.getTime() - Date.now() > 60_000;
  if (stillFresh && it.accessTokenEnc) {
    return { accessToken: decryptToken(it.accessTokenEnc), email: it.email };
  }

  const refreshToken = decryptToken(it.refreshTokenEnc);
  const tokens = await refreshAccessToken(refreshToken);
  const newExpiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in - 30) * 1000);
  await prisma.platformIntegration.update({
    where: { provider: PROVIDER },
    data: {
      accessTokenEnc: encryptToken(tokens.access_token),
      expiresAt: newExpiresAt,
    },
  });
  return { accessToken: tokens.access_token, email: it.email };
}

export type VendorMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Šalje mail koristeći vendor Gmail account (`marin@vatrolog.com`).
 * Ako vendor nije spojen, baca `VENDOR_NOT_CONNECTED`.
 */
export async function sendVendorGmail(input: VendorMailInput): Promise<{ messageId?: string }> {
  const { accessToken, email } = await ensureVendorAccessToken();
  const fromEmail = VENDOR_FROM_EMAIL || email;
  const from = `${VENDOR_FROM_NAME} <${fromEmail}>`;
  await sendGmail(accessToken, from, input.to, input.subject, input.html);
  return {};
}

export async function disconnectVendor(): Promise<void> {
  const it = await getVendorIntegration();
  if (!it) return;

  try {
    if (it.refreshTokenEnc) await revokeToken(decryptToken(it.refreshTokenEnc));
    if (it.accessTokenEnc) await revokeToken(decryptToken(it.accessTokenEnc));
  } catch {
    // ignore revoke errors; we still drop local tokens
  }

  await prisma.platformIntegration.update({
    where: { provider: PROVIDER },
    data: {
      accessTokenEnc: null,
      refreshTokenEnc: null,
      scope: null,
      expiresAt: null,
      connectedAt: null,
    },
  });
}

export const VENDOR_PROVIDER = PROVIDER;
export { fetchGmailEmail, exchangeCodeRaw };
