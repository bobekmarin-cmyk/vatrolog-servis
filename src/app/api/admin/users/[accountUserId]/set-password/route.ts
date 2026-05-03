import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 10;

/**
 * Tenant admin postavlja/mijenja lozinku za bilo koji račun svoje tvrtke
 * (uključujući vlastitu admin lozinku). Uvijek aktivira račun.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ accountUserId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Samo admin može postavljati lozinke." }, { status: 403 });
  }

  const ipKey = clientKeyFromRequest(req);
  const rl = await checkRateLimit("adminSetPassword", ipKey, { limit: 30, windowSec: 900 });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše pokušaja. Pričekaj ${rl.retryAfterSec} s.` },
      { status: 429 },
    );
  }

  const { accountUserId } = await params;
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = String(body.password ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Lozinka mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova.` },
      { status: 400 },
    );
  }

  const target = await prisma.accountUser.findUnique({
    where: { id: accountUserId },
    select: { id: true, companyId: true, username: true },
  });
  if (!target) return NextResponse.json({ error: "Račun nije pronađen." }, { status: 404 });
  if (target.companyId !== session.companyId) {
    return NextResponse.json({ error: "Račun ne pripada vašoj tvrtki." }, { status: 403 });
  }

  const newHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.accountUser.update({
      where: { id: target.id },
      data: { passwordHash: newHash, active: true, emailVerifiedAt: new Date() },
    }),
    prisma.authToken.updateMany({
      where: {
        accountUserId: target.id,
        type: { in: ["PASSWORD_RESET", "ACCOUNT_INVITE", "SUBACCOUNT_PASSWORD_SETUP"] },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        companyId: session.companyId,
        actorId: session.accountUserId,
        actorType: "SELF",
        action:
          target.id === session.accountUserId
            ? "account.password.self-change"
            : "account.password.admin-set",
        entity: "AccountUser",
        entityId: target.id,
        ip: ipKey,
        meta: { username: target.username },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
