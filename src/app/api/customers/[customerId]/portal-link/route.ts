import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function generateSecret(): string {
  return randomBytes(24).toString("base64url");
}

export const POST = apiHandler(async (req: Request, { params }: { params: Promise<{ customerId: string }> }) => {
  const session = await requireActiveSession();
  const { customerId } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId, deletedAt: null },
    select: { id: true, portalSecret: true },
  });
  if (!customer) throw new AppValidationError("Kupac ne postoji.");

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action === "revoke" ? "revoke" : body.action === "regenerate" ? "regenerate" : "ensure";

  let newSecret: string | null = customer.portalSecret;
  if (action === "revoke") {
    newSecret = null;
  } else if (action === "regenerate" || !customer.portalSecret) {
    newSecret = generateSecret();
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { portalSecret: newSecret },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: `customer.portal.${action}`,
    entity: "Customer",
    entityId: customerId,
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, portalSecret: newSecret });
});
