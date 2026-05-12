import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import { generateToken } from "@/lib/authTokens";
import { adminOnboardingEmail, sendSystemMail } from "@/lib/systemMail";

import { redirectRelative } from "@/lib/httpRedirect";
/**
 * Pošalji ADMIN onboarding pozivnicu — koristi se samo za XX-adm račun
 * (workshop računi nemaju ovaj gumb; oni se aktiviraju kroz bulk setup
 * formu koju admin otvori prihvatom svoje pozivnice, ili kroz
 * SUBACCOUNT_PASSWORD_SETUP link).
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
      serviceCode: true,
      accounts: {
        select: { id: true, email: true, role: true, username: true },
        orderBy: { username: "asc" },
      },
    },
  });
  if (!company) return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 404 });

  const account = company.accounts.find((a) => a.id === accountUserId);
  if (!account) return NextResponse.json({ error: "Korisnički račun nije pronađen." }, { status: 404 });
  if (account.role !== "ADMIN") {
    return NextResponse.json(
      {
        error:
          "Pozivnica se šalje samo na admin račun. Workshop računi se aktiviraju kroz admin bulk setup ili setup link.",
      },
      { status: 400 },
    );
  }
  if (!account.email) {
    return NextResponse.json(
      { error: "Račun nema email adresu. Upišite email pa pošaljite pozivnicu." },
      { status: 400 },
    );
  }

  const { plaintext, hash } = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 dana

  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: {
        accountUserId: account.id,
        type: "ACCOUNT_INVITE",
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        type: "ACCOUNT_INVITE",
        tokenHash: hash,
        accountUserId: account.id,
        companyId: company.id,
        email: account.email,
        expiresAt,
      },
    }),
  ]);

  const origin = new URL(req.url).origin;
  const acceptUrl = `${origin}/auth/invite/${encodeURIComponent(plaintext)}`;

  const adminUsername = account.username;
  const workshops = company.accounts
    .filter((a) => a.role !== "ADMIN")
    .map((a) => a.username);

  const tpl = await adminOnboardingEmail({
    companyName: company.name,
    serviceCode: company.serviceCode,
    usernames: { admin: adminUsername, workshops },
    acceptUrl,
  });
  const sent = await sendSystemMail({
    to: account.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    kind: "ACCOUNT_INVITE",
    companyId: company.id,
    accountUserId: account.id,
  });
  if (!sent.ok) {
    return NextResponse.json(
      { error: `Pozivnica nije poslana (${sent.error}).` },
      { status: 500 },
    );
  }

  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "account.invite.send",
      entity: "AccountUser",
      entityId: account.id,
      meta: {
        username: account.username,
        role: account.role,
        to: account.email,
        expiresAt: expiresAt.toISOString(),
        usernamesIncluded: [adminUsername, ...workshops],
      },
    },
  });

  return redirectRelative(`/platform/companies/${companyId}`, 303);
}
