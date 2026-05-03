import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateToken } from "@/lib/authTokens";
import {
  buildLocationLabel,
  buildLocationUsername,
  type LocationKind,
} from "@/lib/companyAccountNaming";
import { sendSystemMail, subaccountSetupEmail } from "@/lib/systemMail";

const MAX_LOCATIONS_PER_KIND = 20;

/**
 * Vendor klikne "+ Dodaj novi račun" → odabere tip lokacije (Stacionarni / Vozilo) i
 * opcionalno labelu. API alocira sljedeći ordinal po kindu, kreira CompanyServiceLocation
 * + workshop AccountUser, izda SUBACCOUNT_PASSWORD_SETUP token i šalje setup mail adminu.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId } = await params;

  // Ulaz prihvaćamo i kao JSON (preporučeno) i kao formData (legacy fallback).
  let kind: LocationKind | null = null;
  let labelOverride: string | null = null;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as
      | { kind?: string; label?: string }
      | null;
    if (body?.kind === "STATIONARY" || body?.kind === "VEHICLE") kind = body.kind;
    labelOverride = (body?.label ?? "").trim() || null;
  } else {
    const form = await req.formData();
    const k = String(form.get("kind") ?? "").trim().toUpperCase();
    if (k === "STATIONARY" || k === "VEHICLE") kind = k as LocationKind;
    labelOverride = String(form.get("label") ?? "").trim() || null;
  }

  if (!kind) {
    return NextResponse.json(
      { error: "Tip lokacije je obavezan (STATIONARY ili VEHICLE)." },
      { status: 400 },
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      serviceCode: true,
      usernameSlug: true,
      accounts: {
        select: { id: true, role: true, email: true },
        where: { role: "ADMIN" },
        take: 1,
      },
      serviceLocations: {
        where: { kind },
        select: { ordinal: true },
        orderBy: { ordinal: "desc" },
        take: 1,
      },
    },
  });
  if (!company) return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 404 });

  const nextOrdinal = (company.serviceLocations[0]?.ordinal ?? 0) + 1;
  if (nextOrdinal > MAX_LOCATIONS_PER_KIND) {
    return NextResponse.json(
      { error: `Maksimalan broj lokacija (${MAX_LOCATIONS_PER_KIND}) je dosegnut za tip ${kind}.` },
      { status: 400 },
    );
  }

  const label = labelOverride || buildLocationLabel(kind, nextOrdinal);
  const username = buildLocationUsername(
    company.serviceCode,
    company.usernameSlug,
    kind,
    nextOrdinal,
  );

  const adminAccount = company.accounts[0] ?? null;
  const setupEmail = adminAccount?.email ?? null;

  const seedSecret = crypto.randomBytes(24).toString("base64url");
  const seedHash = await bcrypt.hash(seedSecret, 12);

  const { plaintext, hash } = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  let createdAccountId: string | null = null;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const location = await tx.companyServiceLocation.create({
        data: { companyId: company.id, kind, label, ordinal: nextOrdinal },
      });
      const account = await tx.accountUser.create({
        data: {
          companyId: company.id,
          username,
          passwordHash: seedHash,
          role: "WORKSHOP",
          active: false,
          email: setupEmail,
          serviceLocationId: location.id,
        },
      });
      await tx.authToken.create({
        data: {
          type: "SUBACCOUNT_PASSWORD_SETUP",
          tokenHash: hash,
          accountUserId: account.id,
          companyId: company.id,
          email: setupEmail,
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: company.id,
          actorType: "PLATFORM",
          action: "platform.account.create",
          entity: "AccountUser",
          entityId: account.id,
          meta: {
            username,
            role: "WORKSHOP",
            serviceLocationId: location.id,
            kind,
            ordinal: nextOrdinal,
            label,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: company.id,
          actorType: "PLATFORM",
          action: "platform.location.create",
          entity: "CompanyServiceLocation",
          entityId: location.id,
          meta: {
            kind,
            ordinal: nextOrdinal,
            label,
            serviceLocationId: location.id,
            accountId: account.id,
          },
        },
      });
      return account;
    });
    createdAccountId = created.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ error: "Račun s tim usernameom već postoji." }, { status: 409 });
    }
    console.error("[platform/accounts/create] error:", e);
    return NextResponse.json({ error: "Greška kod kreiranja računa." }, { status: 500 });
  }

  if (setupEmail) {
    const origin = new URL(req.url).origin;
    const setupUrl = `${origin}/admin/users/setup/${encodeURIComponent(plaintext)}`;
    const tpl = subaccountSetupEmail({
      companyName: company.name,
      username,
      setupUrl,
    });
    const sent = await sendSystemMail({
      to: setupEmail,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      kind: "ACCOUNT_INVITE",
      companyId: company.id,
      accountUserId: createdAccountId,
    });
    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        actorType: "PLATFORM",
        action: "platform.account.subaccount-setup-email",
        entity: "AccountUser",
        entityId: createdAccountId!,
        meta: {
          username,
          to: setupEmail,
          ok: sent.ok,
          transport: sent.ok ? sent.transport : null,
          error: sent.ok ? null : sent.error,
        },
      },
    });
  } else {
    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        actorType: "PLATFORM",
        action: "platform.account.subaccount-setup-email",
        entity: "AccountUser",
        entityId: createdAccountId!,
        meta: { username, to: null, ok: false, error: "ADMIN_HAS_NO_EMAIL" },
      },
    });
  }

  if (ct.includes("application/json")) {
    return NextResponse.json({ ok: true, accountId: createdAccountId, username });
  }
  return NextResponse.redirect(new URL(`/platform/companies/${companyId}`, req.url), 303);
}
