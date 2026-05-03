import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Secure random tokens za password reset, email verify i pozivnice.
 *
 * Uvijek spremamo samo SHA-256 hash tokena u DB, nikad plaintext.
 * Plaintext se vraća samo jednom (prilikom kreiranja) i šalje mailom.
 */

const TOKEN_BYTES = 32;

export function generateToken(): { plaintext: string; hash: string } {
  const buf = crypto.randomBytes(TOKEN_BYTES);
  const plaintext = buf.toString("base64url");
  const hash = hashToken(plaintext);
  return { plaintext, hash };
}

export function hashToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Obriše sve istekle tokene (hygiene).
 * Možemo zvati iz cron joba ili opportunistički.
 */
export async function pruneExpiredTokens(): Promise<number> {
  const now = new Date();
  const del1 = await prisma.authToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null, lte: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7) } }] },
  });
  const del2 = await prisma.userInvite.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { acceptedAt: { not: null, lte: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30) } }] },
  });
  return del1.count + del2.count;
}
