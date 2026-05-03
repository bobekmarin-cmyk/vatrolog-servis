import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  serviceLabelId: z.string().min(5).max(60),
  delta: z.coerce.number().int().refine((v) => v !== 0, "Delta mora biti različita od 0."),
  reason: z.string().trim().min(2).max(300),
});

export const POST = apiHandler(async (req: Request) => {
  const session = await requireActiveSession();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError("Neispravan unos.");
  }

  const { serviceLabelId, delta, reason } = parsed.data;

  const label = await prisma.serviceLabel.findUnique({
    where: { id: serviceLabelId },
    select: { id: true },
  });
  if (!label) {
    throw new AppValidationError("Naljepnica nije pronađena.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const adj = await tx.serviceLabelAdjustment.create({
      data: {
        companyId: session.companyId,
        serviceLabelId,
        delta,
        reason,
        createdById: session.accountUserId,
      },
    });
    await tx.serviceLabelStock.upsert({
      where: {
        companyId_serviceLabelId: {
          companyId: session.companyId,
          serviceLabelId,
        },
      },
      create: {
        companyId: session.companyId,
        serviceLabelId,
        stockQty: delta,
        minStockQty: 0,
      },
      update: {
        stockQty: { increment: delta },
      },
    });
    return adj;
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "serviceLabelAdjustment.create",
    entity: "ServiceLabelAdjustment",
    entityId: created.id,
    meta: { serviceLabelId, delta, reason },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, id: created.id });
});
