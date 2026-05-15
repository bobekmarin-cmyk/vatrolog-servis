import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { resolvePlatformJwtSecret } from "@/lib/authEnv";
import { prisma } from "@/lib/prisma";

export type PlatformRole = "OWNER";

export type PlatformSessionPayload = {
  platformUserId: string;
  role: PlatformRole;
};

const PLATFORM_COOKIE_NAME = "vb_platform_session";

function getPlatformSecret(): Uint8Array {
  const secret = resolvePlatformJwtSecret();
  if (!secret) {
    throw new Error(
      "Nedostaje PLATFORM_AUTH_SECRET. Postavi zaseban long-random secret (različit od AUTH_SECRET) u .env za platform login."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signPlatformSessionToken(payload: PlatformSessionPayload): Promise<string> {
  const secret = getPlatformSecret();
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyPlatformSessionToken(token: string): Promise<PlatformSessionPayload> {
  const secret = getPlatformSecret();
  const { payload } = await jwtVerify(token, secret);
  const platformUserId = payload.platformUserId;
  const role = payload.role;

  if (typeof platformUserId !== "string") throw new Error("Invalid platform token payload.");
  if (role !== "OWNER") throw new Error("Invalid platform token role.");

  return { platformUserId, role };
}

export async function getPlatformSession(): Promise<PlatformSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLATFORM_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = await verifyPlatformSessionToken(token);
    const user = await prisma.platformUser.findFirst({
      where: { id: payload.platformUserId, active: true },
    });
    if (!user) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Obavezan guard za zasticene platform stranice (server komponente).
 * Ako korisnik nije prijavljen, preusmjerava na /platform/login.
 * Defense-in-depth povrh middlewarea (koji moze biti zaobiden ili ukinut).
 */
export async function requirePlatformSession(): Promise<PlatformSessionPayload> {
  const ps = await getPlatformSession();
  if (!ps) redirect("/platform/login");
  return ps;
}

function parsePlatformGoogleEnvList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Vraca true ako je platform Google login uopce omogucen:
 * GOOGLE_CLIENT_ID/SECRET + barem jedan allowlist (emails ili domains).
 * Koristi se na /platform/login i Google OAuth rutama.
 */
export function isPlatformGoogleLoginEnabled(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!id || !secret) return false;
  const emails = parsePlatformGoogleEnvList(process.env.PLATFORM_GOOGLE_ALLOWED_EMAILS);
  const domains = parsePlatformGoogleEnvList(process.env.PLATFORM_GOOGLE_ALLOWED_DOMAINS);
  return emails.length > 0 || domains.length > 0;
}

export function isEmailAllowedByPlatformPolicy(emailRaw: string | null | undefined): boolean {
  const email = (emailRaw ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return false;
  const emails = parsePlatformGoogleEnvList(process.env.PLATFORM_GOOGLE_ALLOWED_EMAILS);
  const domains = parsePlatformGoogleEnvList(process.env.PLATFORM_GOOGLE_ALLOWED_DOMAINS);
  if (emails.length === 0 && domains.length === 0) return false;
  if (emails.includes(email)) return true;
  const domain = email.split("@")[1] ?? "";
  if (domains.includes(domain)) return true;
  return false;
}

