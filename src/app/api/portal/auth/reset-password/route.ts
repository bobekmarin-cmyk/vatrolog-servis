import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { hashToken } from "@/lib/authTokens";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { logInfo, logWarn } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vlasnik postavlja novu lozinku preko reset tokena. Body: { token, password }. */
export const POST = apiHandler(async (req: Request) => {
  const rl = await checkRateLimit("ownerResetPassword", clientKeyFromRequest(req), { limit: 10, windowSec: 900 });
  if (rl.blocked) {
    return NextResponse.json({ error: `Previše pokušaja. Pričekajte ${rl.retryAfterSec} s.` }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (password.length < 8) {
    throw new AppValidationError("Lozinka mora imati barem 8 znakova.", { password: "Prekratka lozinka." });
  }

  const record = await prisma.authToken.findFirst({
    where: { tokenHash: hashToken(token), type: "OWNER_PASSWORD_RESET", usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!record?.ownerId) {
    logWarn("owner_reset_password_invalid_token", {});
    return NextResponse.json({ error: "Link je neispravan ili je istekao." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.owner.update({
      where: { id: record.ownerId },
      data: { passwordHash, emailVerifiedAt: new Date(), sessionsValidAfter: new Date() },
    }),
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.authToken.updateMany({
      where: { ownerId: record.ownerId, type: "OWNER_PASSWORD_RESET", usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  logInfo("owner_reset_password_success", { ownerId: record.ownerId });
  return NextResponse.json({ ok: true });
});
