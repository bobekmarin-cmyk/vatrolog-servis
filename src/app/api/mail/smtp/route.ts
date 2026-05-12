import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/gmail";
import {
  deleteSmtpSettings,
  saveSmtpSettings,
  verifySmtpSettings,
} from "@/lib/tenantMail";

type SmtpBody = {
  host?: unknown;
  port?: unknown;
  secure?: unknown;
  user?: unknown;
  password?: unknown;
  fromEmail?: unknown;
  fromName?: unknown;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SmtpBody;
  try {
    body = (await req.json()) as SmtpBody;
  } catch {
    return NextResponse.json({ error: "Neispravan JSON" }, { status: 400 });
  }

  const host = typeof body.host === "string" ? body.host.trim() : "";
  const portRaw = body.port;
  const port = typeof portRaw === "number" ? portRaw : Number(portRaw);
  const secure = body.secure === true;
  const user = typeof body.user === "string" ? body.user.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fromEmail = typeof body.fromEmail === "string" ? body.fromEmail.trim() : "";
  const fromName = typeof body.fromName === "string" ? body.fromName.trim() : "";

  if (!host) return NextResponse.json({ error: "SMTP host je obavezan." }, { status: 400 });
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return NextResponse.json({ error: "SMTP port mora biti broj između 1 i 65535." }, { status: 400 });
  }
  if (!user) return NextResponse.json({ error: "SMTP korisničko ime je obavezno." }, { status: 400 });
  if (fromEmail && !/^.+@.+\..+$/.test(fromEmail)) {
    return NextResponse.json({ error: "Neispravan format From e-mail adrese." }, { status: 400 });
  }

  // Pri editiranju: ako je lozinka prazna, pokušaj koristiti postojeću iz baze.
  let effectivePassword = password;
  if (!effectivePassword) {
    const existing = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { smtpPassEncrypted: true },
    });
    if (existing?.smtpPassEncrypted) {
      try {
        effectivePassword = decryptToken(existing.smtpPassEncrypted);
      } catch {
        return NextResponse.json(
          { error: "Postojeću lozinku nije moguće dohvatiti. Unesite je ponovno." },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json({ error: "SMTP lozinka je obavezna." }, { status: 400 });
    }
  }

  const verify = await verifySmtpSettings({ host, port, secure, user, password: effectivePassword });
  if (!verify.ok) {
    return NextResponse.json(
      {
        error:
          "Spajanje na SMTP server nije uspjelo. Provjerite host, port, korisničko ime i lozinku.",
        detail: verify.error,
      },
      { status: 400 },
    );
  }

  await saveSmtpSettings(session.companyId, {
    host,
    port,
    secure,
    user,
    password: effectivePassword,
    fromEmail: fromEmail || null,
    fromName: fromName || null,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteSmtpSettings(session.companyId);
  return NextResponse.json({ ok: true });
}
