import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/apiHandler";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { generateToken } from "@/lib/authTokens";
import { passwordResetEmail, sendSystemMail } from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";
import { normalizeOwnerEmail } from "@/lib/ownerAuth";
import { logInfo, logWarn } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUCCESS = "Ako postoji račun povezan s tom adresom, poslali smo link za reset lozinke.";

/** Vlasnik traži reset lozinke. Uvijek vraća OK (ne otkriva postoji li račun). */
export const POST = apiHandler(async (req: Request) => {
  const rl = await checkRateLimit("ownerForgotPassword", clientKeyFromRequest(req), { limit: 5, windowSec: 900 });
  if (rl.blocked) {
    return NextResponse.json({ error: `Previše pokušaja. Pričekajte ${rl.retryAfterSec} s.` }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = normalizeOwnerEmail(String(body.email ?? ""));
  if (!email) return NextResponse.json({ ok: true, message: SUCCESS });

  const owner = await prisma.owner.findUnique({ where: { email }, select: { id: true } });
  if (!owner) {
    logInfo("owner_forgot_password_unknown_email", { email });
    return NextResponse.json({ ok: true, message: SUCCESS });
  }

  const { plaintext, hash } = generateToken();
  await prisma.authToken.create({
    data: {
      type: "OWNER_PASSWORD_RESET",
      tokenHash: hash,
      ownerId: owner.id,
      email,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  const resetUrl = `${getAppBaseUrl()}/korisnik/reset-password?token=${encodeURIComponent(plaintext)}`;
  const mail = await passwordResetEmail(resetUrl);
  const sent = await sendSystemMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text, kind: "PASSWORD_RESET" });
  if (!sent.ok) logWarn("owner_forgot_password_email_failed", { email, error: sent.error });

  return NextResponse.json({ ok: true, message: SUCCESS });
});
