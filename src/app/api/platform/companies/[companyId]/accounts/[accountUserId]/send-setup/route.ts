import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import { generateToken } from "@/lib/authTokens";
import { sendSystemMail, subaccountSetupEmail } from "@/lib/systemMail";

import { redirectRelative } from "@/lib/httpRedirect";
/**
 * Pošalji setup mail za postojeći sub-račun (XX-usrN) — koristi se kad
 * admin nije primio prvi setup mail (npr. spam folder) ili kad treba
 * ponovo aktivirati neaktivirani račun.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string; accountUserId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId, accountUserId } = await params;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      accounts: {
        select: { id: true, username: true, role: true, email: true },
      },
    },
  });
  if (!company) return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 404 });

  const account = company.accounts.find((a) => a.id === accountUserId);
  if (!account) return NextResponse.json({ error: "Račun nije pronađen." }, { status: 404 });
  if (account.role === "ADMIN") {
    return NextResponse.json(
      { error: "Setup mail je za sub-račune. Za admin koristi 'Pošalji pozivnicu' ili 'Pošalji reset'." },
      { status: 400 },
    );
  }

  const adminAccount = company.accounts.find((a) => a.role === "ADMIN") ?? null;
  const setupEmail = adminAccount?.email ?? null;
  if (!setupEmail) {
    return NextResponse.json(
      { error: "Admin tvrtke nema email adresu — postavite email pa pokušajte ponovo." },
      { status: 400 },
    );
  }

  const { plaintext, hash } = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: {
        accountUserId: account.id,
        type: "SUBACCOUNT_PASSWORD_SETUP",
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        type: "SUBACCOUNT_PASSWORD_SETUP",
        tokenHash: hash,
        accountUserId: account.id,
        companyId: company.id,
        email: setupEmail,
        expiresAt,
      },
    }),
  ]);

  const origin = new URL(req.url).origin;
  const setupUrl = `${origin}/admin/users/setup/${encodeURIComponent(plaintext)}`;
  const tpl = subaccountSetupEmail({
    companyName: company.name,
    username: account.username,
    setupUrl,
  });
  const sent = await sendSystemMail({
    to: setupEmail,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    kind: "ACCOUNT_INVITE",
    companyId: company.id,
    accountUserId: account.id,
  });

  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.account.subaccount-setup-email",
      entity: "AccountUser",
      entityId: account.id,
      meta: {
        username: account.username,
        to: setupEmail,
        ok: sent.ok,
        transport: sent.ok ? sent.transport : null,
        error: sent.ok ? null : sent.error,
        expiresAt: expiresAt.toISOString(),
      },
    },
  });

  if (!sent.ok) {
    return NextResponse.json(
      { error: `Setup mail nije poslan (${sent.error}).` },
      { status: 500 },
    );
  }

  return redirectRelative(`/platform/companies/${companyId}`, 303);
}
