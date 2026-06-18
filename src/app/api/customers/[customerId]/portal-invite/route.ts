import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { generateToken } from "@/lib/authTokens";
import { ownerPortalInviteEmail, ownerNewServicerEmail, passwordResetEmail, sendSystemMail } from "@/lib/systemMail";
import { normalizeOwnerEmail } from "@/lib/ownerAuth";
import { findExistingPortalOwnerByOib } from "@/lib/ownerSharing";
import { ensureOwnerOrgForOib, ensureMembership } from "@/lib/ownerOrg";
import { getAppBaseUrl } from "@/lib/appVersion";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 dana

/**
 * Serviser šalje / povlači pozivnicu kupcu na Korisnički portal.
 * Body: { action: "invite" | "revoke", email?: string }
 */
export const POST = apiHandler(
  async (req: Request, { params }: { params: Promise<{ customerId: string }> }) => {
    const session = await requireActiveSession();
    const { customerId } = await params;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: session.companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        shortName: true,
        email: true,
        oib: true,
        company: { select: { name: true } },
        ownerLink: { select: { id: true, status: true, invitedEmail: true } },
      },
    });
    if (!customer) throw new AppValidationError("Kupac ne postoji.");

    const body = (await req.json().catch(() => ({}))) as { action?: string; email?: string; ownerId?: string };
    const KNOWN_ACTIONS = [
      "revoke",
      "share",
      "approve",
      "decline",
      "cancelInvite",
      "revokeAccount",
      "resetPassword",
    ] as const;
    const action = (KNOWN_ACTIONS as readonly string[]).includes(body.action ?? "")
      ? (body.action as (typeof KNOWN_ACTIONS)[number])
      : "invite";
    const audit = extractAuditMeta(req);

    // Povuci pristup pojedinom računu (membership je na razini vlasnika/OIB-a —
    // račun gubi pristup cijelom portalu vlasnika kod svih povezanih servisa).
    if (action === "revokeAccount") {
      const targetOwnerId = String(body.ownerId ?? "");
      if (!targetOwnerId) throw new AppValidationError("Nedostaje račun.");
      if (!customer.oib) throw new AppValidationError("Kupac nema OIB.");
      const org = await prisma.ownerOrg.findUnique({ where: { oib: customer.oib }, select: { id: true } });
      if (org) {
        await prisma.ownerOrgMembership.updateMany({
          where: { ownerId: targetOwnerId, ownerOrgId: org.id },
          data: { status: "REVOKED", revokedAt: new Date() },
        });
      }
      await logAudit({
        companyId: session.companyId,
        actorId: session.accountUserId,
        actorType: "ACCOUNT_USER",
        action: "customer.portal.account.revoke",
        entity: "Owner",
        entityId: targetOwnerId,
        meta: { customerId },
        ip: audit.ip,
        userAgent: audit.userAgent,
      });
      return NextResponse.json({ ok: true });
    }

    // Pošalji vlasniku mail za reset lozinke (serviser ne vidi ni ne postavlja lozinku).
    if (action === "resetPassword") {
      const targetOwnerId = String(body.ownerId ?? "");
      if (!targetOwnerId) throw new AppValidationError("Nedostaje račun.");
      const owner = await prisma.owner.findUnique({ where: { id: targetOwnerId }, select: { email: true } });
      if (!owner?.email) throw new AppValidationError("Račun ne postoji.");
      const { plaintext, hash } = generateToken();
      await prisma.authToken.create({
        data: {
          type: "OWNER_PASSWORD_RESET",
          tokenHash: hash,
          ownerId: targetOwnerId,
          email: owner.email,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      const resetUrl = `${getAppBaseUrl()}/korisnik/reset-password?token=${encodeURIComponent(plaintext)}`;
      const mail = await passwordResetEmail(resetUrl);
      const sent = await sendSystemMail({
        to: owner.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        kind: "PASSWORD_RESET",
        companyId: session.companyId,
      });
      if (!sent.ok) return NextResponse.json({ error: `Slanje e-maila nije uspjelo: ${sent.error}` }, { status: 500 });
      await logAudit({
        companyId: session.companyId,
        actorId: session.accountUserId,
        actorType: "ACCOUNT_USER",
        action: "customer.portal.account.resetPassword",
        entity: "Owner",
        entityId: targetOwnerId,
        ip: audit.ip,
        userAgent: audit.userAgent,
      });
      return NextResponse.json({ ok: true });
    }

    // Otkaži pending pozivnicu za određeni e-mail.
    if (action === "cancelInvite") {
      const target = normalizeOwnerEmail(body.email ?? "");
      if (!target) throw new AppValidationError("Nedostaje e-mail.");
      await prisma.authToken.updateMany({
        where: { type: "OWNER_INVITE", usedAt: null, email: target },
        data: { usedAt: new Date() },
      });
      await logAudit({
        companyId: session.companyId,
        actorId: session.accountUserId,
        actorType: "ACCOUNT_USER",
        action: "customer.portal.invite.cancel",
        entity: "Customer",
        entityId: customerId,
        meta: { email: target },
        ip: audit.ip,
        userAgent: audit.userAgent,
      });
      return NextResponse.json({ ok: true });
    }

    // Cross-serviser: poveži ovog kupca s postojećim Owner računom (po OIB-u).
    // Serviser ovime daje privolu da se njegovi aparati prikažu vlasniku.
    if (action === "share") {
      const existing = await findExistingPortalOwnerByOib(customer.oib, session.companyId);
      if (!existing) {
        throw new AppValidationError("Za ovaj OIB ne postoji aktivan Korisnički portal.");
      }

      const ownerOrgId = await ensureOwnerOrgForOib(customer.oib, customer.shortName ?? customer.name);
      await ensureMembership(existing.ownerId, ownerOrgId, {
        invitedEmail: existing.ownerEmail,
        invitedByCompanyId: session.companyId,
      });

      await prisma.ownerCustomerLink.upsert({
        where: { customerId },
        create: {
          companyId: session.companyId,
          customerId,
          invitedEmail: existing.ownerEmail,
          invitedByAccountUserId: session.accountUserId,
          ownerId: existing.ownerId,
          ownerOrgId,
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
        update: {
          invitedEmail: existing.ownerEmail,
          invitedByAccountUserId: session.accountUserId,
          ownerId: existing.ownerId,
          ownerOrgId,
          status: "ACTIVE",
          acceptedAt: new Date(),
          revokedAt: null,
        },
      });

      // Obavijesti vlasnika (best-effort, ne ruši radnju).
      try {
        const tpl = await ownerNewServicerEmail({
          servicerName: customer.company.name,
          portalUrl: `${getAppBaseUrl()}/korisnik`,
        });
        await sendSystemMail({
          to: existing.ownerEmail,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          kind: "OWNER_PORTAL_INVITE",
          companyId: session.companyId,
        });
      } catch {
        /* best-effort */
      }

      await logAudit({
        companyId: session.companyId,
        actorId: session.accountUserId,
        actorType: "ACCOUNT_USER",
        action: "customer.portal.share",
        entity: "Customer",
        entityId: customerId,
        meta: { ownerEmail: existing.ownerEmail },
        ip: audit.ip,
        userAgent: audit.userAgent,
      });

      return NextResponse.json({ ok: true, status: "ACTIVE" });
    }

    // Serviser odobrava / odbija vlasnikov zahtjev za pristup (REQUESTED).
    if (action === "approve" || action === "decline") {
      if (!customer.ownerLink || customer.ownerLink.status !== "REQUESTED") {
        throw new AppValidationError("Nema zahtjeva za odobrenje.");
      }

      if (action === "decline") {
        await prisma.ownerCustomerLink.update({
          where: { id: customer.ownerLink.id },
          data: { status: "DECLINED" },
        });
        await logAudit({
          companyId: session.companyId,
          actorId: session.accountUserId,
          actorType: "ACCOUNT_USER",
          action: "customer.portal.requestDecline",
          entity: "Customer",
          entityId: customerId,
          ip: audit.ip,
          userAgent: audit.userAgent,
        });
        return NextResponse.json({ ok: true, status: "DECLINED" });
      }

      await prisma.ownerCustomerLink.update({
        where: { id: customer.ownerLink.id },
        data: { status: "ACTIVE", acceptedAt: new Date(), revokedAt: null },
      });

      // Obavijesti vlasnika da su aparati sad dostupni (best-effort).
      try {
        const tpl = await ownerNewServicerEmail({
          servicerName: customer.company.name,
          portalUrl: `${getAppBaseUrl()}/korisnik`,
        });
        await sendSystemMail({
          to: customer.ownerLink.invitedEmail,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          kind: "OWNER_PORTAL_INVITE",
          companyId: session.companyId,
        });
      } catch {
        /* best-effort */
      }

      await logAudit({
        companyId: session.companyId,
        actorId: session.accountUserId,
        actorType: "ACCOUNT_USER",
        action: "customer.portal.requestApprove",
        entity: "Customer",
        entityId: customerId,
        ip: audit.ip,
        userAgent: audit.userAgent,
      });
      return NextResponse.json({ ok: true, status: "ACTIVE" });
    }

    if (action === "revoke") {
      if (customer.ownerLink) {
        await prisma.$transaction([
          prisma.ownerCustomerLink.update({
            where: { id: customer.ownerLink.id },
            data: { status: "REVOKED", revokedAt: new Date() },
          }),
          prisma.authToken.updateMany({
            where: {
              type: "OWNER_INVITE",
              usedAt: null,
              meta: { path: ["customerId"], equals: customerId },
            },
            data: { usedAt: new Date() },
          }),
        ]);
      }
      await logAudit({
        companyId: session.companyId,
        actorId: session.accountUserId,
        actorType: "ACCOUNT_USER",
        action: "customer.portal.revoke",
        entity: "Customer",
        entityId: customerId,
        ip: audit.ip,
        userAgent: audit.userAgent,
      });
      return NextResponse.json({ ok: true, status: "REVOKED" });
    }

    // invite / resend
    const rl = await checkRateLimit("ownerInvite", clientKeyFromRequest(req), { limit: 20, windowSec: 3600 });
    if (rl.blocked) {
      return NextResponse.json(
        { error: `Previše pozivnica. Pričekajte ${rl.retryAfterSec} s.` },
        { status: 429 },
      );
    }

    const email = normalizeOwnerEmail(body.email || customer.email || "");
    if (!EMAIL_RE.test(email)) {
      throw new AppValidationError("Unesite ispravnu e-mail adresu vlasnika.");
    }

    const existingOwner = await prisma.owner.findUnique({
      where: { email },
      select: { id: true },
    });

    // Org po OIB-u — veza ga uvijek nosi (i prije nego vlasnik registrira račun).
    const ownerOrgId = await ensureOwnerOrgForOib(customer.oib, customer.shortName ?? customer.name);

    // Ne degradiraj već aktivnu vezu (drugi račun je možda već aktivan) —
    // pozivanje dodatnog računa ne smije sakriti aparate ostalim računima.
    const alreadyActive = customer.ownerLink?.status === "ACTIVE";
    const linkStatus = alreadyActive ? "ACTIVE" : "PENDING_INVITE";

    const link = await prisma.ownerCustomerLink.upsert({
      where: { customerId },
      create: {
        companyId: session.companyId,
        customerId,
        invitedEmail: email,
        invitedByAccountUserId: session.accountUserId,
        ownerOrgId,
        status: "PENDING_INVITE",
      },
      update: {
        invitedEmail: email,
        invitedByAccountUserId: session.accountUserId,
        ownerOrgId,
        status: linkStatus,
        ...(alreadyActive ? {} : { revokedAt: null }),
      },
      select: { id: true },
    });

    const { plaintext, hash } = generateToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await prisma.$transaction([
      // Otkaži samo prethodnu nepotrošenu pozivnicu za ISTI e-mail (resend),
      // ne diraj pozivnice za druge račune istog vlasnika.
      prisma.authToken.updateMany({
        where: { type: "OWNER_INVITE", usedAt: null, email },
        data: { usedAt: new Date() },
      }),
      prisma.authToken.create({
        data: {
          type: "OWNER_INVITE",
          tokenHash: hash,
          email,
          companyId: session.companyId,
          ownerId: existingOwner?.id ?? null,
          expiresAt,
          meta: { ownerCustomerLinkId: link.id, customerId, ownerOrgId },
        },
      }),
    ]);

    const acceptUrl = `${getAppBaseUrl()}/korisnik/invite/${encodeURIComponent(plaintext)}`;
    const tpl = await ownerPortalInviteEmail({
      servicerName: customer.company.name,
      customerName: customer.shortName ?? customer.name,
      acceptUrl,
    });
    const sent = await sendSystemMail({
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      kind: "OWNER_PORTAL_INVITE",
      companyId: session.companyId,
    });
    if (!sent.ok) {
      return NextResponse.json({ error: `Slanje e-maila nije uspjelo: ${sent.error}` }, { status: 500 });
    }

    await logAudit({
      companyId: session.companyId,
      actorId: session.accountUserId,
      actorType: "ACCOUNT_USER",
      action: "customer.portal.invite",
      entity: "Customer",
      entityId: customerId,
      meta: { email, ownerExisted: !!existingOwner },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });

    return NextResponse.json({ ok: true, status: "PENDING_INVITE", email });
  },
);
