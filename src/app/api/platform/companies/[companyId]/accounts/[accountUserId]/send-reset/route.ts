import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { generateToken } from "@/lib/authTokens";
import { passwordResetEmail, sendSystemMail } from "@/lib/systemMail";
import { checkRateLimit } from "@/lib/rateLimit";

import { redirectRelative } from "@/lib/httpRedirect";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string; accountUserId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const rl = await checkRateLimit("platformAccountReset", ps.platformUserId, {
    limit: 10,
    windowSec: 60,
  });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše pokušaja. Pokušaj za ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const { companyId, accountUserId } = await params;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      accounts: {
        where: { id: accountUserId },
        select: { id: true, email: true, role: true, username: true },
      },
    },
  });
  if (!company) return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 404 });
  const account = company.accounts[0];
  if (!account) return NextResponse.json({ error: "Korisnički račun nije pronađen." }, { status: 404 });
  if (!account.email) {
    return NextResponse.json(
      { error: "Račun nema email adresu. Upišite email pa pošaljite reset link." },
      { status: 400 },
    );
  }

  const { plaintext, hash } = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min

  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { accountUserId: account.id, type: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        type: "PASSWORD_RESET",
        tokenHash: hash,
        accountUserId: account.id,
        companyId: company.id,
        email: account.email,
        expiresAt,
      },
    }),
  ]);

  const origin = new URL(req.url).origin;
  const resetUrl = `${origin}/auth/reset/${encodeURIComponent(plaintext)}`;
  const tpl = passwordResetEmail(resetUrl);

  const sent = await sendSystemMail({
    to: account.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    kind: "PASSWORD_RESET",
    companyId: company.id,
    accountUserId: account.id,
  });

  if (!sent.ok) {
    return NextResponse.json(
      { error: `Reset link nije poslan (${sent.error}).` },
      { status: 500 },
    );
  }

  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.account.send-reset",
      entity: "AccountUser",
      entityId: account.id,
      meta: {
        username: account.username,
        role: account.role,
        to: account.email,
        expiresAt: expiresAt.toISOString(),
        transport: sent.transport,
      },
    },
  });

  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, transport: sent.transport });
  }
  return redirectRelative(`/platform/companies/${companyId}?reset=sent`, 303);
}
