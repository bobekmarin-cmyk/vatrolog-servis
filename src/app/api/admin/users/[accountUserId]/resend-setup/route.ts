import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateToken } from "@/lib/authTokens";
import { sendSystemMail, subaccountSetupEmail } from "@/lib/systemMail";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * Tenant admin pošalje (ili re-pošalje) setup mail za sub-račun svoje tvrtke.
 * Setup mail ide na admin email. Uvijek generira novi
 * SUBACCOUNT_PASSWORD_SETUP token i poništava ranije nepotrošene.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ accountUserId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Samo admin može slati setup mail." }, { status: 403 });
  }

  const ipKey = clientKeyFromRequest(req);
  const rl = await checkRateLimit("adminResendSetup", ipKey, { limit: 12, windowSec: 900 });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše pokušaja. Pričekaj ${rl.retryAfterSec} s.` },
      { status: 429 },
    );
  }

  const { accountUserId } = await params;
  const target = await prisma.accountUser.findUnique({
    where: { id: accountUserId },
    select: { id: true, companyId: true, username: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "Račun nije pronađen." }, { status: 404 });
  if (target.companyId !== session.companyId) {
    return NextResponse.json({ error: "Račun ne pripada vašoj tvrtki." }, { status: 403 });
  }
  if (target.role === "ADMIN") {
    return NextResponse.json(
      { error: "Setup mail je za sub-račune. Za admin koristi reset lozinke." },
      { status: 400 },
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: {
      name: true,
      accounts: {
        where: { role: "ADMIN" },
        select: { email: true },
        take: 1,
      },
    },
  });
  const adminEmail = company?.accounts[0]?.email ?? null;
  if (!adminEmail) {
    return NextResponse.json(
      { error: "Admin tvrtke nema email — postavite admin email pa pokušajte ponovo." },
      { status: 400 },
    );
  }
  if (!company?.name) {
    return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 404 });
  }

  const { plaintext, hash } = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: {
        accountUserId: target.id,
        type: "SUBACCOUNT_PASSWORD_SETUP",
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        type: "SUBACCOUNT_PASSWORD_SETUP",
        tokenHash: hash,
        accountUserId: target.id,
        companyId: session.companyId,
        email: adminEmail,
        expiresAt,
      },
    }),
  ]);

  const origin = new URL(req.url).origin;
  const setupUrl = `${origin}/admin/users/setup/${encodeURIComponent(plaintext)}`;
  const tpl = subaccountSetupEmail({
    companyName: company.name,
    username: target.username,
    setupUrl,
  });
  const sent = await sendSystemMail({
    to: adminEmail,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    kind: "ACCOUNT_INVITE",
    companyId: session.companyId,
    accountUserId: target.id,
  });

  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      actorId: session.accountUserId,
      actorType: "SELF",
      action: "account.subaccount.resend-setup",
      entity: "AccountUser",
      entityId: target.id,
      ip: ipKey,
      meta: {
        username: target.username,
        to: adminEmail,
        ok: sent.ok,
        transport: sent.ok ? sent.transport : null,
        error: sent.ok ? null : sent.error,
        expiresAt: expiresAt.toISOString(),
      },
    },
  });

  if (!sent.ok) {
    return NextResponse.json({ error: `Setup mail nije poslan (${sent.error}).` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, to: adminEmail });
}
