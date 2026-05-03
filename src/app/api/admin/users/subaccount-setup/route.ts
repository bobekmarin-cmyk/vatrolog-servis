import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/authTokens";
import { getSession } from "@/lib/auth";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 10;

/**
 * Tenant-side endpoint za postavljanje lozinke novog sub-računa
 * (XX-usrN) preko SUBACCOUNT_PASSWORD_SETUP tokena.
 *
 * Pravila:
 *  - Mora biti prijavljen kao admin iste tvrtke kojoj sub-račun pripada.
 *  - Token mora biti valjan, neiskorišten i ne istekao.
 *  - Sub-račun mora pripadati istoj tvrtki kao i admin.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Samo admin može postavljati lozinke." }, { status: 403 });
  }

  const ipKey = clientKeyFromRequest(req);
  const rl = await checkRateLimit("subaccountSetup", ipKey, { limit: 12, windowSec: 900 });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše pokušaja. Pričekaj ${rl.retryAfterSec} s.` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");

  if (!token) return NextResponse.json({ error: "Nedostaje token." }, { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Lozinka mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova.` },
      { status: 400 },
    );
  }

  const tokenHash = hashToken(token);
  const record = await prisma.authToken.findFirst({
    where: {
      tokenHash,
      type: "SUBACCOUNT_PASSWORD_SETUP",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      accountUser: { select: { id: true, role: true, companyId: true, username: true } },
    },
  });
  if (!record || !record.accountUser) {
    return NextResponse.json({ error: "Setup link je neispravan ili je istekao." }, { status: 400 });
  }
  if (record.accountUser.role === "ADMIN") {
    return NextResponse.json(
      { error: "Setup link je dostupan samo za sub-račune (workshop)." },
      { status: 400 },
    );
  }
  if (record.companyId !== session.companyId || record.accountUser.companyId !== session.companyId) {
    return NextResponse.json(
      { error: "Setup link nije za vašu tvrtku." },
      { status: 403 },
    );
  }

  const newHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.accountUser.update({
      where: { id: record.accountUser.id },
      data: {
        passwordHash: newHash,
        active: true,
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.updateMany({
      where: {
        accountUserId: record.accountUser.id,
        type: "SUBACCOUNT_PASSWORD_SETUP",
        usedAt: null,
        id: { not: record.id },
      },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        companyId: session.companyId,
        actorId: session.accountUserId,
        actorType: "SELF",
        action: "account.subaccount.password-set",
        entity: "AccountUser",
        entityId: record.accountUser.id,
        ip: ipKey,
        meta: { username: record.accountUser.username },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
