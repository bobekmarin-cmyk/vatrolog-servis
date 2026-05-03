import { prisma } from "@/lib/prisma";
import { signPlatformSessionToken } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { checkLoginRateLimit, clearLoginFailures, clientKeyFromRequest, recordLoginFailure } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const ipKey = `platform:${clientKeyFromRequest(req)}`;
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

  const user = await prisma.platformUser.findUnique({ where: { username } });
  if (!user || !user.active) {
    recordLoginFailure(ipKey);
    return NextResponse.json({ error: "Neispravni podaci za prijavu." }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    recordLoginFailure(ipKey);
    return NextResponse.json({ error: "Neispravni podaci za prijavu." }, { status: 401 });
  }

  clearLoginFailures(ipKey);

  let token: string;
  try {
    token = await signPlatformSessionToken({
      platformUserId: user.id,
      role: user.role,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Greška pri izdavanju sesije.";
    if (msg.includes("PLATFORM_AUTH_SECRET") || msg.includes("AUTH_SECRET")) {
      return NextResponse.json(
        {
          error:
            "Poslužitelj nije ispravno konfiguriran (PLATFORM_AUTH_SECRET / AUTH_SECRET). Provjeri .env i ponovno pokreni server.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 303: nakon POST-a uvijek prebaci na GET (izbjegava POST redirect probleme)
  const res = NextResponse.redirect(new URL("/platform/companies", req.url), 303);
  res.cookies.set("vb_platform_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}

