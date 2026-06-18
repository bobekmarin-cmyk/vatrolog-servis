import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { hashToken } from "@/lib/authTokens";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { signOwnerSessionToken, OWNER_SESSION_COOKIE } from "@/lib/ownerAuth";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { ensureOwnerOrgForOib, ensureMembership } from "@/lib/ownerOrg";

/** Org veze (po OIB-u kupca) na koju se vlasnik veže pri prihvaćanju pozivnice. */
async function resolveLinkOrgId(linkId?: string): Promise<string | null> {
  if (!linkId) return null;
  const link = await prisma.ownerCustomerLink.findUnique({
    where: { id: linkId },
    select: { ownerOrgId: true, customer: { select: { oib: true, name: true, shortName: true } } },
  });
  if (!link) return null;
  if (link.ownerOrgId) return link.ownerOrgId;
  if (link.customer.oib) {
    return ensureOwnerOrgForOib(link.customer.oib, link.customer.shortName ?? link.customer.name);
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vlasnik prihvaća pozivnicu: postavlja lozinku (ako je novi račun) i aktivira
 * vezu s kupcem. Token je iz e-maila pa je e-mail time dokazan (emailVerifiedAt).
 */
export const POST = apiHandler(async (req: Request) => {
  const rl = await checkRateLimit("ownerAcceptInvite", clientKeyFromRequest(req), { limit: 15, windowSec: 900 });
  if (rl.blocked) {
    return NextResponse.json({ error: `Previše pokušaja. Pričekajte ${rl.retryAfterSec} s.` }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string; password?: string; name?: string };
  const token = String(body.token ?? "");
  if (!token) throw new AppValidationError("Nedostaje token pozivnice.");

  const record = await prisma.authToken.findFirst({
    where: { tokenHash: hashToken(token), type: "OWNER_INVITE", usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!record?.email) {
    return NextResponse.json({ error: "Pozivnica je neispravna ili je istekla." }, { status: 400 });
  }

  const email = record.email.toLowerCase();
  const meta = (record.meta ?? {}) as { ownerCustomerLinkId?: string; customerId?: string; ownerOrgId?: string };
  const linkId = meta.ownerCustomerLinkId;

  const owner = await prisma.owner.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  const audit = extractAuditMeta(req);

  const linkOrgId = (await resolveLinkOrgId(linkId)) ?? meta.ownerOrgId ?? null;

  // Postojeći račun s lozinkom → samo aktiviraj vezu, korisnik se prijavljuje normalno.
  if (owner?.passwordHash) {
    await prisma.$transaction([
      ...(linkId
        ? [
            prisma.ownerCustomerLink.update({
              where: { id: linkId },
              data: {
                ownerId: owner.id,
                ...(linkOrgId ? { ownerOrgId: linkOrgId } : {}),
                status: "ACTIVE",
                acceptedAt: new Date(),
                revokedAt: null,
              },
            }),
          ]
        : []),
      prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    if (linkOrgId) {
      await ensureMembership(owner.id, linkOrgId, { invitedEmail: email, invitedByCompanyId: record.companyId });
    }
    await logAudit({
      companyId: record.companyId,
      actorType: "CUSTOMER_PORTAL",
      action: "owner.invite.accept_existing",
      entity: "Owner",
      entityId: owner.id,
      ip: audit.ip,
      userAgent: audit.userAgent,
    });
    return NextResponse.json({ ok: true, existingAccount: true });
  }

  // Novi (ili bez lozinke) račun → obavezna lozinka.
  const password = String(body.password ?? "");
  if (password.length < 8) {
    throw new AppValidationError("Lozinka mora imati barem 8 znakova.", { password: "Prekratka lozinka." });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const name = body.name?.trim() || null;

  const savedOwner = await prisma.owner.upsert({
    where: { email },
    create: { email, passwordHash, name, emailVerifiedAt: new Date() },
    update: { passwordHash, emailVerifiedAt: new Date(), ...(name ? { name } : {}) },
    select: { id: true },
  });

  await prisma.$transaction([
    ...(linkId
      ? [
          prisma.ownerCustomerLink.update({
            where: { id: linkId },
            data: {
              ownerId: savedOwner.id,
              ...(linkOrgId ? { ownerOrgId: linkOrgId } : {}),
              status: "ACTIVE",
              acceptedAt: new Date(),
              revokedAt: null,
            },
          }),
        ]
      : []),
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date(), ownerId: savedOwner.id } }),
  ]);

  if (linkOrgId) {
    await ensureMembership(savedOwner.id, linkOrgId, { invitedEmail: email, invitedByCompanyId: record.companyId });
  }
  await prisma.owner.update({ where: { id: savedOwner.id }, data: { lastLoginAt: new Date() } });

  await logAudit({
    companyId: record.companyId,
    actorType: "CUSTOMER_PORTAL",
    action: "owner.invite.accept_new",
    entity: "Owner",
    entityId: savedOwner.id,
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  const sessionToken = await signOwnerSessionToken(savedOwner.id);
  const res = NextResponse.json({ ok: true, redirect: "/korisnik" });
  res.cookies.set(OWNER_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
});
