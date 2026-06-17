import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { resolveOwnerJwtSecret } from "@/lib/authEnv";
import { prisma } from "@/lib/prisma";

/**
 * Auth sloj za korisnički portal (vlasnici aparata, model `Owner`).
 * Potpuno odvojen od tenant (`vb_session`) i platform (`vb_platform_session`)
 * sesija: zaseban cookie + `kind: "owner"` u payloadu + DB lookup.
 */

export const OWNER_SESSION_COOKIE = "vb_owner_session";

export type OwnerSessionPayload = {
  ownerId: string;
  kind: "owner";
};

function getOwnerSecret(): Uint8Array {
  const secret = resolveOwnerJwtSecret();
  if (!secret) {
    throw new Error(
      "Nedostaje OWNER_AUTH_SECRET (ili AUTH_SECRET) za korisnički portal. Postavi long-random secret u .env.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signOwnerSessionToken(ownerId: string): Promise<string> {
  const secret = getOwnerSecret();
  const payload: OwnerSessionPayload = { ownerId, kind: "owner" };
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyOwnerSessionToken(token: string): Promise<OwnerSessionPayload> {
  const secret = getOwnerSecret();
  const { payload } = await jwtVerify(token, secret);
  const ownerId = payload.ownerId;
  const kind = payload.kind;
  if (typeof ownerId !== "string" || kind !== "owner") {
    throw new Error("Invalid owner session token payload.");
  }
  return { ownerId, kind: "owner" };
}

export type OwnerSession = {
  ownerId: string;
  email: string;
  name: string | null;
};

/**
 * Vrati prijavljenog vlasnika ili null. Radi DB lookup da deaktivirani/obrisani
 * računi i force-logout (sessionsValidAfter) odmah padaju.
 */
export async function getOwnerSession(): Promise<OwnerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(OWNER_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const secret = getOwnerSecret();
    const verified = await jwtVerify(token, secret);
    const payload = await verifyOwnerSessionToken(token);
    const iatSec = typeof verified.payload.iat === "number" ? verified.payload.iat : null;

    const owner = await prisma.owner.findUnique({
      where: { id: payload.ownerId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        sessionsValidAfter: true,
      },
    });
    if (!owner) return null;
    if (!owner.emailVerifiedAt) return null;

    if (owner.sessionsValidAfter && iatSec !== null) {
      const cutoffSec = Math.floor(owner.sessionsValidAfter.getTime() / 1000);
      if (iatSec < cutoffSec) return null;
    }

    return { ownerId: owner.id, email: owner.email, name: owner.name };
  } catch {
    return null;
  }
}

export async function requireOwnerSession(): Promise<OwnerSession> {
  const s = await getOwnerSession();
  if (!s) throw new Error("UNAUTHENTICATED_OWNER");
  return s;
}

/** Normalizacija e-maila vlasnika (uvijek lowercase + trim). */
export function normalizeOwnerEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
