import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { generateToken } from "@/lib/authTokens";
import { ownerPortalInviteEmail, ownerNewServicerEmail, sendSystemMail } from "@/lib/systemMail";
import { normalizeOwnerEmail } from "@/lib/ownerAuth";
import { findExistingPortalOwnerByOib } from "@/lib/ownerSharing";
import { ensureOwnerOrgForOib, ensureMembership, ownerOrgHasActiveAdmin } from "@/lib/ownerOrg";
import { getAppBaseUrl } from "@/lib/appVersion";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { companyPlanAllows, planUpgradeMessage } from "@/lib/subscriptionPlan";

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

    if (!(await companyPlanAllows(session.companyId, "CUSTOMER_PORTAL"))) {
      throw new AppValidationError(planUpgradeMessage("CUSTOMER_PORTAL"));
    }

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

    const body = (await req.json().catch(() => ({}))) as { action?: string; email?: string };
    const KNOWN_ACTIONS = ["revoke", "share", "approve", "decline"] as const;
    const action = (KNOWN_ACTIONS as readonly string[]).includes(body.action ?? "")
      ? (body.action as (typeof KNOWN_ACTIONS)[number])
      : "invite";
    const audit = extractAuditMeta(req);

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

    // Serviser poziva samo JEDNOG administratora tvrtke. Daljnje račune dodaje
    // sam admin u korisničkom portalu — serviser ne upravlja tuđim računima.
    if (await ownerOrgHasActiveAdmin(ownerOrgId)) {
      throw new AppValidationError(
        "Ovaj vlasnik već ima aktiviran korisnički portal. Daljnje račune dodaje administrator tvrtke iz portala.",
      );
    }

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
      // Otkaži prethodne nepotrošene pozivnice za ovog kupca (samo jedan admin).
      prisma.authToken.updateMany({
        where: { type: "OWNER_INVITE", usedAt: null, meta: { path: ["customerId"], equals: customerId } },
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
          meta: { ownerCustomerLinkId: link.id, customerId, ownerOrgId, role: "ADMIN" },
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
