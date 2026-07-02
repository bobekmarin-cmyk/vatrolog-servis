import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const priceSchema = z
  .number()
  .finite()
  .min(0)
  .max(99999999.99)
  .nullable()
  .optional();

const schema = z.object({
  labelPeriodicPrice: priceSchema,
  labelApparatusMassPrice: priceSchema,
  labelCylinderMassPrice: priceSchema,
});

export const POST = apiHandler(async (req: Request) => {
  const session = await requireAdminSession();

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError("Neispravan unos cijena naljepnica.");
  }

  const data = {
    labelPeriodicPrice: parsed.data.labelPeriodicPrice ?? null,
    labelApparatusMassPrice: parsed.data.labelApparatusMassPrice ?? null,
    labelCylinderMassPrice: parsed.data.labelCylinderMassPrice ?? null,
  };

  await prisma.company.update({
    where: { id: session.companyId },
    data,
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "companyAuthorization.labelPrices.save",
    entity: "Company",
    entityId: session.companyId,
    meta: data,
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true });
});
