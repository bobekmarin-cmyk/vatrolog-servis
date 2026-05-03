import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import { generateToken } from "@/lib/authTokens";

/**
 * Generira SUBACCOUNT_PASSWORD_SETUP link za sub-račun bez slanja maila.
 * Koristi se kad mail ne stigne (spam) — vendor može kopirati link i
 * proslijediti adminu kroz drugi kanal (WhatsApp, SMS, telefon...).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; accountUserId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId, accountUserId } = await params;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
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
      { error: "Setup link je dostupan samo za sub-račune." },
      { status: 400 },
    );
  }

  const adminAccount = company.accounts.find((a) => a.role === "ADMIN") ?? null;
  const setupEmail = adminAccount?.email ?? null;

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
    prisma.auditLog.create({
      data: {
        companyId,
        actorType: "PLATFORM",
        action: "platform.account.copy-setup-link",
        entity: "AccountUser",
        entityId: account.id,
        meta: {
          username: account.username,
          expiresAt: expiresAt.toISOString(),
        },
      },
    }),
  ]);

  // Trebamo origin da generiramo apsolutni URL
  const origin = new URL(_req.url).origin;
  const setupUrl = `${origin}/admin/users/setup/${encodeURIComponent(plaintext)}`;

  return NextResponse.json({
    ok: true,
    url: setupUrl,
    expiresAt: expiresAt.toISOString(),
    username: account.username,
  });
}
