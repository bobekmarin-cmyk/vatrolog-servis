import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/authTokens";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { logInfo, logWarn } from "@/lib/logger";
import { apiHandler } from "@/lib/apiHandler";
import { parseOrThrow, resetPasswordSchema } from "@/schemas";

export const runtime = "nodejs";

/**
 * Postavi novu lozinku preko tokena iz emaila.
 * Ulaz: { token, password }
 */
export const POST = apiHandler(async (req: Request) => {
  const ipKey = clientKeyFromRequest(req);
  const rl = await checkRateLimit("resetPassword", ipKey, { limit: 10, windowSec: 900 });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše pokušaja. Pričekaj ${rl.retryAfterSec} s.` },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { token, password } = parseOrThrow(resetPasswordSchema, body);

  const hash = hashToken(token);
  const record = await prisma.authToken.findFirst({
    where: {
      tokenHash: hash,
      type: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record?.accountUserId) {
    logWarn("reset_password_invalid_token", { ipKey });
    return NextResponse.json({ error: "Link je neispravan ili je istekao." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.accountUser.update({
      where: { id: record.accountUserId },
      data: { passwordHash },
    }),
    prisma.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Poništi sve ostale active reset tokene za istog korisnika
    prisma.authToken.updateMany({
      where: {
        accountUserId: record.accountUserId,
        type: "PASSWORD_RESET",
        usedAt: null,
        id: { not: record.id },
      },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        companyId: record.companyId,
        actorId: record.accountUserId,
        actorType: "SELF",
        action: "password.reset",
        entity: "AccountUser",
        entityId: record.accountUserId,
        ip: ipKey,
      },
    }),
  ]);

  logInfo("reset_password_success", { accountUserId: record.accountUserId });
  return NextResponse.json({ ok: true });
});
