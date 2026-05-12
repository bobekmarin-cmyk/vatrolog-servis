import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/authTokens";
import { emailVerificationEmail, sendSystemMail } from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { logInfo } from "@/lib/logger";
import { apiHandler } from "@/lib/apiHandler";
import { parseOrThrow } from "@/schemas";
import { z } from "zod";
import { emailSchema } from "@/schemas/common";

export const runtime = "nodejs";

/**
 * Pošalji novi email-verify link na zadanu adresu (ako za nju postoji
 * AccountUser s nepotvrđenim emailom). Ne otkrivamo postoji li account
 * — uvijek vraćamo isti success status.
 */
const requestSchema = z.object({ email: emailSchema });

export const POST = apiHandler(async (req: Request) => {
  const ipKey = clientKeyFromRequest(req);
  const rl = await checkRateLimit("resendVerify", ipKey, { limit: 5, windowSec: 3600 });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše pokušaja. Pričekaj ${rl.retryAfterSec} s.` },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseOrThrow(requestSchema, body);
  const email = parsed.email.toLowerCase();

  const account = await prisma.accountUser.findFirst({
    where: { email, emailVerifiedAt: null, active: true, company: { deletedAt: null } },
    select: { id: true, companyId: true },
  });

  if (account) {
    const { plaintext, hash } = generateToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await prisma.$transaction([
      prisma.authToken.updateMany({
        where: { accountUserId: account.id, type: "EMAIL_VERIFY", usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.authToken.create({
        data: {
          type: "EMAIL_VERIFY",
          tokenHash: hash,
          accountUserId: account.id,
          companyId: account.companyId,
          email,
          expiresAt,
        },
      }),
    ]);
    const verifyUrl = `${getAppBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(plaintext)}`;
    const tpl = await emailVerificationEmail(verifyUrl);
    await sendSystemMail({
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      kind: "EMAIL_VERIFY",
      companyId: account.companyId,
      accountUserId: account.id,
    });
    logInfo("resend_verification_sent", { accountUserId: account.id });
  } else {
    logInfo("resend_verification_no_account", { email });
  }

  // Uvijek isti odgovor (ne otkrivamo postoji li račun).
  return NextResponse.json({ ok: true });
});
