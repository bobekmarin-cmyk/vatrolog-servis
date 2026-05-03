import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  partId: z.string().min(5).max(60),
  delta: z.coerce.number().int().refine((v) => v !== 0, "Promjena ne smije biti 0."),
  reason: z.string().trim().min(2, "Upišite razlog.").max(500),
});

export const POST = apiHandler(async (req: Request) => {
  const session = await requireActiveSession();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".")] = issue.message;
    }
    throw new AppValidationError("Neispravan unos.", fields);
  }

  const part = await prisma.part.findFirst({
    where: {
      id: parsed.data.partId,
      OR: [{ companyId: null }, { companyId: session.companyId }],
    },
    select: { id: true },
  });
  if (!part) throw new AppValidationError("Dio ne postoji ili vam nije dostupan.");

  const adjustment = await prisma.$transaction(async (tx) => {
    const created = await tx.stockAdjustment.create({
      data: {
        companyId: session.companyId,
        partId: parsed.data.partId,
        delta: parsed.data.delta,
        reason: parsed.data.reason.trim(),
        createdById: session.accountUserId,
      },
      select: { id: true, delta: true },
    });

    await tx.partStock.upsert({
      where: { companyId_partId: { companyId: session.companyId, partId: parsed.data.partId } },
      create: {
        companyId: session.companyId,
        partId: parsed.data.partId,
        stockQty: parsed.data.delta,
        minStockQty: 0,
      },
      update: {
        stockQty: { increment: parsed.data.delta },
      },
    });

    return created;
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "stockAdjustment.create",
    entity: "StockAdjustment",
    entityId: adjustment.id,
    meta: { partId: parsed.data.partId, delta: parsed.data.delta, reason: parsed.data.reason },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, id: adjustment.id });
});
