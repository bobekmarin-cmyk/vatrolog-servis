import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/apiHandler";
import { checkLoginRateLimit, clearLoginFailures, clientKeyFromRequest, recordLoginFailure } from "@/lib/rateLimit";
import { signOwnerSessionToken, OWNER_SESSION_COOKIE, normalizeOwnerEmail } from "@/lib/ownerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Prijava vlasnika na Korisnički portal. Body: { email, password }. */
export const POST = apiHandler(async (req: Request) => {
  const ipKey = `owner:${clientKeyFromRequest(req)}`;
  const blocked = await checkLoginRateLimit(ipKey);
  if (blocked.blocked) {
    return NextResponse.json(
      { error: `Previše neuspjelih prijava. Pokušajte ponovno za ${blocked.retryAfterSec} s.` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = normalizeOwnerEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Unesite e-mail i lozinku." }, { status: 400 });
  }

  const owner = await prisma.owner.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, emailVerifiedAt: true },
  });

  if (!owner?.passwordHash) {
    recordLoginFailure(ipKey);
    return NextResponse.json({ error: "Neispravni podaci za prijavu." }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, owner.passwordHash);
  if (!ok) {
    recordLoginFailure(ipKey);
    return NextResponse.json({ error: "Neispravni podaci za prijavu." }, { status: 401 });
  }

  if (!owner.emailVerifiedAt) {
    return NextResponse.json(
      { error: "E-mail adresa nije potvrđena. Aktivirajte račun preko pozivnice.", code: "EMAIL_NOT_VERIFIED" },
      { status: 403 },
    );
  }

  clearLoginFailures(ipKey);
  await prisma.owner.update({ where: { id: owner.id }, data: { lastLoginAt: new Date() } });

  const token = await signOwnerSessionToken(owner.id);
  const res = NextResponse.json({ ok: true, redirect: "/korisnik" });
  res.cookies.set(OWNER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
});
