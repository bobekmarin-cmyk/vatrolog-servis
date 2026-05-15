/**
 * Google OAuth 2.0 / OIDC za /platform login.
 *
 * Koristi isti `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` kao Gmail integracije
 * (jedan OAuth client u Google Cloud Console-u s vise registriranih redirect URI-ja),
 * ali drugi redirect URI: `{NEXT_PUBLIC_APP_URL}/api/platform/auth/google/callback`.
 *
 * Sigurnosni model:
 *  - Gumb se prikazuje samo ako je env-allowlist popunjen (defaultu je iskljuceno).
 *  - Nakon Google logina trazi se PlatformUser po `googleSub` ili `email`.
 *    Ako ne postoji nijedan, prijava se odbija — nema auto-provisioning-a.
 *  - `email_verified` od Google-a se forsira (true).
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import { getPublicAppUrl } from "@/lib/appVersion";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  }
  return cachedJwks;
}

function getClientId(): string | null {
  const v = process.env.GOOGLE_CLIENT_ID?.trim();
  return v && v.length > 0 ? v : null;
}
function getClientSecret(): string | null {
  const v = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return v && v.length > 0 ? v : null;
}

/** Redirect URI mora biti dodan u Google Cloud Console (Authorized redirect URIs). */
export function getPlatformGoogleRedirectUri(): string {
  const override = process.env.GOOGLE_REDIRECT_URI_PLATFORM_AUTH?.trim();
  if (override) return override;
  return `${getPublicAppUrl()}/api/platform/auth/google/callback`;
}

export function buildPlatformGoogleConsentUrl(state: string): string {
  const clientId = getClientId();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID nije postavljen.");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getPlatformGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  hostedDomain: string | null;
};

export async function exchangePlatformGoogleCode(code: string): Promise<GoogleIdentity> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID/SECRET nije postavljen.");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getPlatformGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GOOGLE_TOKEN_EXCHANGE_FAILED_${res.status}:${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new Error("GOOGLE_ID_TOKEN_MISSING");

  const { payload } = await jwtVerify(json.id_token, getJwks(), {
    issuer: [GOOGLE_ISSUER, "accounts.google.com"],
    audience: clientId,
  });

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  const emailVerified = payload.email_verified === true;
  const name = typeof payload.name === "string" ? payload.name : null;
  const hostedDomain = typeof payload.hd === "string" ? payload.hd : null;

  if (!sub || !email) throw new Error("GOOGLE_ID_TOKEN_INCOMPLETE");
  if (!emailVerified) throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");

  return { sub, email, emailVerified, name, hostedDomain };
}
