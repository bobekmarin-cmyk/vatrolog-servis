import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { getOwnerSession } from "@/lib/ownerAuth";
import { ownerCanRequestCustomer } from "@/lib/ownerServicers";
import { ownerAccessRequestEmail, sendSystemMail } from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vlasnik traži da portal prikaže i aparate nekog servisa (po OIB-u).
 * Kreira REQUESTED vezu i obavještava servisera — serviser je mora odobriti.
 * Body: { customerId: string }
 */
export const POST = apiHandler(async (req: Request) => {
  const session = await getOwnerSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const rl = await checkRateLimit("ownerAccessRequest", clientKeyFromRequest(req), {
    limit: 30,
    windowSec: 3600,
  });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše zahtjeva. Pričekajte ${rl.retryAfterSec} s.` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { customerId?: string };
  const customerId = String(body.customerId ?? "");
  if (!customerId) throw new AppValidationError("Nedostaje servis.");

  const check = await ownerCanRequestCustomer(session.ownerId, customerId);
  if ("error" in check) throw new AppValidationError(check.error);

  const owner = await prisma.owner.findUnique({
    where: { id: session.ownerId },
    select: { email: true, name: true },
  });
  if (!owner) return NextResponse.json({ error: "Račun ne postoji." }, { status: 404 });

  await prisma.ownerCustomerLink.upsert({
    where: { customerId },
    create: {
      companyId: check.companyId,
      customerId,
      invitedEmail: owner.email,
      ownerId: session.ownerId,
      status: "REQUESTED",
    },
    update: {
      ownerId: session.ownerId,
      invitedEmail: owner.email,
      status: "REQUESTED",
      revokedAt: null,
    },
  });

  // Obavijesti administratore servisa (best-effort).
  try {
    const admins = await prisma.accountUser.findMany({
      where: { companyId: check.companyId, role: "ADMIN", active: true, email: { not: null } },
      select: { email: true },
    });
    const recipients = [...new Set(admins.map((a) => a.email).filter((e): e is string => !!e))];
    if (recipients.length > 0) {
      const tpl = await ownerAccessRequestEmail({
        ownerName: owner.name || owner.email,
        ownerEmail: owner.email,
        customerName: check.customerName,
        reviewUrl: `${getAppBaseUrl()}/customers/${customerId}`,
      });
      for (const to of recipients) {
        await sendSystemMail({
          to,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          kind: "OWNER_PORTAL_ACCESS_REQUEST",
          companyId: check.companyId,
        });
      }
    }
  } catch {
    /* best-effort */
  }

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: check.companyId,
    actorType: "CUSTOMER_PORTAL",
    action: "owner.servicer.requestAccess",
    entity: "Customer",
    entityId: customerId,
    meta: { ownerEmail: owner.email },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, status: "REQUESTED" });
});
