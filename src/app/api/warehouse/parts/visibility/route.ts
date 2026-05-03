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
  hidden: z.boolean(),
});

/**
 * Deaktivira/aktivira dio za tenant-a (upis u PartStock.hidden).
 * Globalni dijelovi ostaju netaknuti za ostale tenante.
 */
export const POST = apiHandler(async (req: Request) => {
  const session = await requireActiveSession();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError("Neispravan unos.");
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
      minStockQty: 0,
      hidden: parsed.data.hidden,
    },
    update: {
      hidden: parsed.data.hidden,
    },
    select: { id: true, hidden: true },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "partStock.visibility",
    entity: "PartStock",
    entityId: up.id,
    meta: { partId: parsed.data.partId, hidden: parsed.data.hidden },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, hidden: up.hidden });
});
