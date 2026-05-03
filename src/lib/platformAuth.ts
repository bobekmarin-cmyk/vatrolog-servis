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

