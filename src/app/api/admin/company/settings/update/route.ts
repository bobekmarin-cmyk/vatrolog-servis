import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, signSessionToken } from "@/lib/auth";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });

  const form = await req.formData();
  const street = String(form.get("street") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const postalCode = String(form.get("postalCode") ?? "").trim();
  const iban = String(form.get("iban") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();

  if (!street || !city || !postalCode) return badRequest("Unesi adresu (ulica, grad i poštanski broj).");
  if (!iban) return badRequest("IBAN je obavezan.");
  if (!email) return badRequest("E-mail je obavezan.");
  if (!email.includes("@")) return badRequest("E-mail nije ispravan.");
  if (!phone) return badRequest("Kontakt broj je obavezan.");

  const dnPrefixRaw = String(form.get("deliveryNoteNumberPrefix") ?? "").trim().toUpperCase();
  const cleanedPrefix = dnPrefixRaw.replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const deliveryNoteNumberPrefix =
    cleanedPrefix.length === 0 ? null : cleanedPrefix.length >= 2 ? cleanedPrefix : null;
  if (cleanedPrefix.length === 1) {
    return badRequest("Prefiks otpremnice mora imati najmanje 2 znaka ili ostaviti prazno za automatski.");
  }

  const wasSetupComplete = session.setupComplete === true;

  const company = await prisma.company.update({
    where: { id: session.companyId },
    data: { street, city, postalCode, iban, email, phone, deliveryNoteNumberPrefix },
    select: { iban: true, email: true, phone: true },
  });

  const setupComplete =
    (company.iban ?? "").trim().length > 0 &&
    (company.email ?? "").trim().length > 0 &&
    (company.phone ?? "").trim().length > 0;

  const token = await signSessionToken({
    accountUserId: session.accountUserId,
    companyId: session.companyId,
    role: session.role,
    setupComplete,
    activeUntilTs: session.activeUntilTs,
    blocked: session.blocked,
    isVendorImpersonation: session.isVendorImpersonation,
    serviceLocationId: session.serviceLocationId ?? null,
  });

  // Inicijalni setup (prvi put da je sve popunjeno) → preusmjeri admina na dashboard.
  // Obični edit → ostani na postavkama, front prikazuje toast "Postavke spremljene".
  const justCompletedSetup = setupComplete && !wasSetupComplete;
  const res = NextResponse.json({
    ok: true,
    setupComplete,
    justCompletedSetup,
    redirectTo: justCompletedSetup ? "/dashboard" : null,
  });
  res.cookies.set("vb_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

