import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { generateToken } from "@/lib/authTokens";
import { passwordResetEmail, sendSystemMail } from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";
import { logInfo, logWarn } from "@/lib/logger";
import { apiHandler } from "@/lib/apiHandler";
import { forgotPasswordSchema, parseOrThrow } from "@/schemas";

export const runtime = "nodejs";

/**
 * Zatraži reset lozinke.
 * - Ulaz: { email }
 * - Uvijek vraća OK da napadač ne može otkriti koji emailovi postoje u bazi.
 * - Rate-limited: 5 zahtjeva / 15 min po IP-u.
 */
export const POST = apiHandler(async (req: Request) => {
  const ipKey = clientKeyFromRequest(req);
  const rl = await checkRateLimit("forgotPassword", ipKey, { limit: 5, windowSec: 900 });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše pokušaja. Pričekaj ${rl.retryAfterSec} s.` },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { email: rawEmail } = parseOrThrow(forgotPasswordSchema, body);
  const email = rawEmail.toLowerCase();

  const account = await prisma.accountUser.findFirst({
    where: { email, active: true },
    include: { company: { select: { name: true, deletedAt: true, blocked: true } } },
  });

  // Uvijek vraćamo istu poruku
  const successMessage = "Ako postoji račun povezan s tom email adresom, poslali smo link za reset lozinke.";

  if (!account || account.company.deletedAt) {
    logInfo("forgot_password_unknown_email", { email });
    return NextResponse.json({ ok: true, message: successMessage });
  }

  const { plaintext, hash } = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  await prisma.authToken.create({
    data: {
      type: "PASSWORD_RESET",
      tokenHash: hash,
      accountUserId: account.id,
      companyId: account.companyId,
      email,
      expiresAt,
    },
  });

  const resetUrl = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(plaintext)}`;
  const mail = passwordResetEmail(resetUrl);
  const sent = await sendSystemMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });

  if (!sent.ok) {
    logWarn("forgot_password_email_failed", { email, error: sent.error });
  } else {
    logInfo("forgot_password_email_sent", { accountUserId: account.id, companyId: account.companyId });
  }

  return NextResponse.json({ ok: true, message: successMessage });
});
