import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ova ruta se sada koristi SAMO za podešavanje minimalne zalihe (minStockQty).
 * Promjena stvarnog stanja (stockQty) ide kroz skladišne primke
 * (/api/warehouse/receipts) ili ručne korekcije (/api/warehouse/adjustments).
 */
const schema = z.object({
  partId: z.string().min(5).max(60),
  minStockQty: z.coerce.number().int().nonnegative(),
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

  const up = await prisma.partStock.upsert({
    where: { companyId_partId: { companyId: session.companyId, partId: parsed.data.partId } },
    create: {
      companyId: session.companyId,
      partId: parsed.data.partId,
      stockQty: 0,
      minStockQty: parsed.data.minStockQty,
    },
    update: {
      minStockQty: parsed.data.minStockQty,
    },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "partStock.update",
    entity: "PartStock",
    entityId: up.id,
    meta: { partId: parsed.data.partId, minStockQty: parsed.data.minStockQty },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, stockQty: up.stockQty, minStockQty: up.minStockQty });
});
