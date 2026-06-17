import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { generateToken } from "@/lib/authTokens";
import { ownerPortalInviteEmail, ownerNewServicerEmail, sendSystemMail } from "@/lib/systemMail";
import { normalizeOwnerEmail } from "@/lib/ownerAuth";
import { findExistingPortalOwnerByOib } from "@/lib/ownerSharing";
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

    const body = (await req.json().catch(() => ({}))) as { action?: string; email?: string };
    const action =
      body.action === "revoke" ? "revoke" : body.action === "share" ? "share" : "invite";
    const audit = extractAuditMeta(req);

    // Cross-serviser: poveži ovog kupca s postojećim Owner računom (po OIB-u).
    // Serviser ovime daje privolu da se njegovi aparati prikažu vlasniku.
    if (action === "share") {
      const existing = await findExistingPortalOwnerByOib(customer.oib, session.companyId);
      if (!existing) {
        throw new AppValidationError("Za ovaj OIB ne postoji aktivan Korisnički portal.");
      }

      await prisma.ownerCustomerLink.upsert({
        where: { customerId },
        create: {
          companyId: session.companyId,
          customerId,
          invitedEmail: existing.ownerEmail,
          invitedByAccountUserId: session.accountUserId,
          ownerId: existing.ownerId,
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
        update: {
          invitedEmail: existing.ownerEmail,
          invitedByAccountUserId: session.accountUserId,
          ownerId: existing.ownerId,
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

    const link = await prisma.ownerCustomerLink.upsert({
      where: { customerId },
      create: {
        companyId: session.companyId,
        customerId,
        invitedEmail: email,
        invitedByAccountUserId: session.accountUserId,
        ownerId: existingOwner?.id ?? null,
        status: "PENDING_INVITE",
      },
      update: {
        invitedEmail: email,
        invitedByAccountUserId: session.accountUserId,
        ownerId: existingOwner?.id ?? null,
        status: "PENDING_INVITE",
        revokedAt: null,
      },
      select: { id: true },
    });

    const { plaintext, hash } = generateToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await prisma.$transaction([
      prisma.authToken.updateMany({
        where: {
          type: "OWNER_INVITE",
          usedAt: null,
          meta: { path: ["customerId"], equals: customerId },
        },
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
          meta: { ownerCustomerLinkId: link.id, customerId },
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
