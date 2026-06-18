import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { generateToken } from "@/lib/authTokens";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { getOwnerSession, normalizeOwnerEmail } from "@/lib/ownerAuth";
import { getActiveOwnerOrgId, isOwnerOrgAdmin } from "@/lib/ownerOrg";
import { ownerMemberInviteEmail, passwordResetEmail, sendSystemMail } from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 dana

/**
 * Admin tvrtke upravlja korisničkim računima svoje tvrtke u Korisničkom portalu.
 * Body: { action: "invite" | "revoke" | "resetPassword" | "setRole", email?, ownerId?, role? }
 *
 * Sve radnje su ograničene na AKTIVNU tvrtku (ownerOrg) i samo ADMIN ima pristup.
 */
export const POST = apiHandler(async (req: Request) => {
  const session = await getOwnerSession();
  if (!session) throw new AppValidationError("Niste prijavljeni.");

  const ownerOrgId = await getActiveOwnerOrgId(session.ownerId);
  if (!ownerOrgId) throw new AppValidationError("Odaberite tvrtku.");

  if (!(await isOwnerOrgAdmin(session.ownerId, ownerOrgId))) {
    return NextResponse.json({ error: "Samo administrator tvrtke može upravljati računima." }, { status: 403 });
  }

  const org = await prisma.ownerOrg.findUnique({ where: { id: ownerOrgId }, select: { name: true } });
  const audit = extractAuditMeta(req);
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    email?: string;
    ownerId?: string;
    role?: "ADMIN" | "MEMBER";
  };
  const action = body.action ?? "invite";

  // ── Povuci pristup računu (member ili drugi admin; ne sebi) ──
  if (action === "revoke") {
    const targetOwnerId = String(body.ownerId ?? "");
    if (!targetOwnerId) throw new AppValidationError("Nedostaje račun.");
    if (targetOwnerId === session.ownerId) throw new AppValidationError("Ne možete povući vlastiti pristup.");

    const membership = await prisma.ownerOrgMembership.findUnique({
      where: { ownerId_ownerOrgId: { ownerId: targetOwnerId, ownerOrgId } },
      select: { id: true },
    });
    if (!membership) throw new AppValidationError("Račun nije član ove tvrtke.");

    await prisma.ownerOrgMembership.update({
      where: { id: membership.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await logAudit({
      actorId: session.ownerId,
      actorType: "CUSTOMER_PORTAL",
      action: "owner.account.revoke",
      entity: "OwnerOrg",
      entityId: ownerOrgId,
      meta: { targetOwnerId },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });
    return NextResponse.json({ ok: true });
  }

  // ── Promijeni ulogu (ADMIN/MEMBER) ──
  if (action === "setRole") {
    const targetOwnerId = String(body.ownerId ?? "");
    const role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
    if (!targetOwnerId) throw new AppValidationError("Nedostaje račun.");

    const membership = await prisma.ownerOrgMembership.findUnique({
      where: { ownerId_ownerOrgId: { ownerId: targetOwnerId, ownerOrgId } },
      select: { id: true, role: true },
    });
    if (!membership) throw new AppValidationError("Račun nije član ove tvrtke.");

    // Ne dopusti uklanjanje zadnjeg admina.
    if (membership.role === "ADMIN" && role === "MEMBER") {
      const admins = await prisma.ownerOrgMembership.count({
        where: { ownerOrgId, status: "ACTIVE", role: "ADMIN" },
      });
      if (admins <= 1) throw new AppValidationError("Tvrtka mora imati barem jednog administratora.");
    }

    await prisma.ownerOrgMembership.update({ where: { id: membership.id }, data: { role } });
    await logAudit({
      actorId: session.ownerId,
      actorType: "CUSTOMER_PORTAL",
      action: "owner.account.setRole",
      entity: "OwnerOrg",
      entityId: ownerOrgId,
      meta: { targetOwnerId, role },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });
    return NextResponse.json({ ok: true });
  }

  // ── Reset lozinke za člana (admin ne postavlja lozinku, samo šalje mail) ──
  if (action === "resetPassword") {
    const targetOwnerId = String(body.ownerId ?? "");
    if (!targetOwnerId) throw new AppValidationError("Nedostaje račun.");
    const member = await prisma.ownerOrgMembership.findUnique({
      where: { ownerId_ownerOrgId: { ownerId: targetOwnerId, ownerOrgId } },
      select: { owner: { select: { id: true, email: true } } },
    });
    if (!member?.owner?.email) throw new AppValidationError("Račun nije član ove tvrtke.");

    const { plaintext, hash } = generateToken();
    await prisma.authToken.create({
      data: {
        type: "OWNER_PASSWORD_RESET",
        tokenHash: hash,
        ownerId: member.owner.id,
        email: member.owner.email,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    const resetUrl = `${getAppBaseUrl()}/korisnik/reset-password?token=${encodeURIComponent(plaintext)}`;
    const mail = await passwordResetEmail(resetUrl);
    const sent = await sendSystemMail({
      to: member.owner.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      kind: "PASSWORD_RESET",
    });
    if (!sent.ok) return NextResponse.json({ error: `Slanje e-maila nije uspjelo: ${sent.error}` }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Pozovi novog korisnika (član ili admin) ──
  const rl = await checkRateLimit("ownerMemberInvite", clientKeyFromRequest(req), { limit: 20, windowSec: 3600 });
  if (rl.blocked) {
    return NextResponse.json({ error: `Previše pozivnica. Pričekajte ${rl.retryAfterSec} s.` }, { status: 429 });
  }

  const email = normalizeOwnerEmail(body.email ?? "");
  if (!EMAIL_RE.test(email)) throw new AppValidationError("Unesite ispravnu e-mail adresu.");
  const role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";

  // Već aktivan član ove tvrtke?
  const existingOwner = await prisma.owner.findUnique({ where: { email }, select: { id: true } });
  if (existingOwner) {
    const m = await prisma.ownerOrgMembership.findUnique({
      where: { ownerId_ownerOrgId: { ownerId: existingOwner.id, ownerOrgId } },
      select: { status: true },
    });
    if (m?.status === "ACTIVE") throw new AppValidationError("Ovaj račun već ima pristup ovoj tvrtki.");
  }

  const { plaintext, hash } = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.$transaction([
    // Otkaži prethodnu nepotrošenu pozivnicu za isti e-mail u ovoj tvrtki.
    prisma.authToken.updateMany({
      where: {
        type: "OWNER_INVITE",
        usedAt: null,
        email,
        meta: { path: ["ownerOrgId"], equals: ownerOrgId },
      },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        type: "OWNER_INVITE",
        tokenHash: hash,
        email,
        ownerId: existingOwner?.id ?? null,
        expiresAt,
        meta: { ownerOrgId, role, invitedByOwnerId: session.ownerId },
      },
    }),
  ]);

  const acceptUrl = `${getAppBaseUrl()}/korisnik/invite/${encodeURIComponent(plaintext)}`;
  const tpl = await ownerMemberInviteEmail({ customerName: org?.name ?? "tvrtka", acceptUrl });
  const sent = await sendSystemMail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    kind: "OWNER_PORTAL_INVITE",
  });
  if (!sent.ok) return NextResponse.json({ error: `Slanje e-maila nije uspjelo: ${sent.error}` }, { status: 500 });

  await logAudit({
    actorId: session.ownerId,
      actorType: "CUSTOMER_PORTAL",
      action: "owner.account.invite",
    entity: "OwnerOrg",
    entityId: ownerOrgId,
    meta: { email, role },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true });
});
