import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/authTokens";
import { adminOnboardingEmail, sendSystemMail } from "@/lib/systemMail";

/**
 * Generic invite send endpoint koji koristi sub-modal/akcijski API.
 * Šalje admin onboarding mail SAMO za ADMIN račun. Workshop računi se
 * aktiviraju kroz bulk setup formu (admin invite) ili SUBACCOUNT_PASSWORD_SETUP.
 */
export async function POST(req: Request) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { accountUserId?: string };
  const accountUserId = String(body.accountUserId ?? "");
  if (!accountUserId) return NextResponse.json({ error: "Nedostaje accountUserId." }, { status: 400 });

  const account = await prisma.accountUser.findUnique({
    where: { id: accountUserId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          serviceCode: true,
          accounts: { select: { username: true, role: true }, orderBy: { username: "asc" } },
        },
      },
    },
  });
  if (!account?.company) return NextResponse.json({ error: "Račun nije pronađen." }, { status: 404 });
  if (account.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Pozivnica je dostupna samo za admin račun." },
      { status: 400 },
    );
  }
  if (!account.email) return NextResponse.json({ error: "Račun nema email adresu." }, { status: 400 });

  const { plaintext, hash } = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 dana
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { accountUserId, type: "ACCOUNT_INVITE", usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        accountUserId,
        companyId: account.company.id,
        type: "ACCOUNT_INVITE",
        tokenHash: hash,
        email: account.email,
        expiresAt,
      },
    }),
  ]);

  const origin = new URL(req.url).origin;
  const acceptUrl = `${origin}/auth/invite/${encodeURIComponent(plaintext)}`;

  const workshops = account.company.accounts
    .filter((a) => a.role !== "ADMIN")
    .map((a) => a.username);

  const tpl = await adminOnboardingEmail({
    companyName: account.company.name,
    serviceCode: account.company.serviceCode,
    usernames: { admin: account.username, workshops },
    acceptUrl,
  });
  const sent = await sendSystemMail({
    to: account.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    kind: "ACCOUNT_INVITE",
    companyId: account.company.id,
    accountUserId,
  });
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 500 });

  await prisma.auditLog.create({
    data: {
      companyId: account.company.id,
      actorType: "PLATFORM",
      action: "account.invite.send",
      entity: "AccountUser",
      entityId: accountUserId,
      meta: {
        expiresAt: expiresAt.toISOString(),
        email: account.email,
        usernamesIncluded: [account.username, ...workshops],
      },
    },
  });

  return NextResponse.json({ ok: true });
}
