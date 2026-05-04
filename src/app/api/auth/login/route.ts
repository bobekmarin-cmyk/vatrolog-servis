import { prisma } from "@/lib/prisma";
import { signSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { checkLoginRateLimit, clearLoginFailures, clientKeyFromRequest, recordLoginFailure } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const ipKey = clientKeyFromRequest(req);
  const blocked = await checkLoginRateLimit(ipKey);
  if (blocked.blocked) {
    return NextResponse.json(
      { error: `Previše neuspjelih prijava. Pokušaj ponovno za ${blocked.retryAfterSec} s.` },
      { status: 429 }
    );
  }

  const form = await req.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!username || !password) {
    return NextResponse.json({ error: "Nedostaje korisničko ime ili lozinka." }, { status: 400 });
  }

  const account = await prisma.accountUser.findUnique({
    where: { username },
    select: {
      id: true,
      companyId: true,
      role: true,
      passwordHash: true,
      active: true,
      email: true,
      emailVerifiedAt: true,
      serviceLocationId: true,
      company: {
        select: {
          id: true,
          deletedAt: true,
          blocked: true,
          activeUntil: true,
          iban: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  // Ne otkrivamo postoji li user ili ne
  if (!account || !account.active || account.company.deletedAt) {
    recordLoginFailure(ipKey);
    return NextResponse.json({ error: "Neispravni podaci za prijavu." }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, account.passwordHash);
  if (!ok) {
    recordLoginFailure(ipKey);
    return NextResponse.json({ error: "Neispravni podaci za prijavu." }, { status: 401 });
  }

  if (account.email && !account.emailVerifiedAt) {
    return NextResponse.json(
      {
        error:
          "Email adresa nije potvrđena. Provjerite inbox ili zatražite novu potvrdu na stranici za potvrdu emaila.",
        code: "EMAIL_NOT_VERIFIED",
      },
      { status: 403 },
    );
  }

  clearLoginFailures(ipKey);

  const workshopSessionId = account.role === "WORKSHOP" ? crypto.randomUUID() : undefined;

  await prisma.accountUser.update({
    where: { id: account.id },
    data: {
      lastLoginAt: new Date(),
      ...(workshopSessionId ? { currentSessionId: workshopSessionId } : {}),
    },
  });

  const setupComplete =
    (account.company.iban ?? "").trim().length > 0 &&
    (account.company.email ?? "").trim().length > 0 &&
    (account.company.phone ?? "").trim().length > 0;

  const activeUntilTs = account.company.activeUntil ? account.company.activeUntil.getTime() : 0;

  let token: string;
  try {
    token = await signSessionToken({
      accountUserId: account.id,
      companyId: account.companyId,
      role: account.role,
      setupComplete,
      activeUntilTs,
      blocked: account.company.blocked,
      serviceLocationId: account.role === "ADMIN" ? null : account.serviceLocationId,
      sessionId: workshopSessionId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Greška pri izdavanju sesije.";
    if (msg.includes("AUTH_SECRET")) {
      return NextResponse.json(
        {
          error:
            "Poslužitelj nije ispravno konfiguriran (nedostaje AUTH_SECRET u .env). Dodaj AUTH_SECRET i ponovno pokreni dev server.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const afterLogin =
    !setupComplete
      ? account.role === "ADMIN"
        ? "/admin/settings"
        : "/setup-required"
      : "/dashboard";
  // Dva puta:
  //   - Fetch (Accept: application/json) → JSON; klijent radi window.location.assign.
  //   - HTML form (bez JS / fallback) → 303 redirect.
  const wantsJson = (req.headers.get("accept") ?? "").toLowerCase().includes("application/json");
  const res = wantsJson
    ? NextResponse.json({ ok: true as const, redirect: afterLogin })
    : NextResponse.redirect(new URL(afterLogin, req.url), 303);
  res.cookies.set("vb_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dana
  });
  // Defensive cleanup: ako je ostao stari impersonation state, normalni tenant login ga gasi.
  res.cookies.set("vb_impersonation_mode", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set("vb_impersonation_write", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}

