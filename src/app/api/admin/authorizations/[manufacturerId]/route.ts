import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  active: z.boolean(),
  expiresAt: z.string().trim().min(1).nullable().optional(),
  periodicLabelCode: z.string().trim().max(50).nullable().optional(),
  apparatusMassLabelCode: z.string().trim().max(50).nullable().optional(),
  cylinderMassLabelCode: z.string().trim().max(50).nullable().optional(),
});

export const POST = apiHandler(
  async (req: Request, ctx: { params: Promise<{ manufacturerId: string }> }) => {
    const session = await requireAdminSession();
    const { manufacturerId } = await ctx.params;

    const manu = await prisma.manufacturer.findUnique({
      where: { id: manufacturerId },
      select: { id: true, name: true },
    });
    if (!manu) {
      throw new AppValidationError("Proizvođač nije pronađen.");
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppValidationError("Neispravan unos.");
    }

    let expiresAt: Date | null = null;
    if (parsed.data.expiresAt) {
      const d = new Date(parsed.data.expiresAt);
      if (Number.isNaN(d.getTime())) {
        throw new AppValidationError("Neispravan datum isteka.");
      }
      expiresAt = d;
    }

    const data = {
      active: parsed.data.active,
      expiresAt,
      periodicLabelCode:
        parsed.data.periodicLabelCode === undefined
          ? undefined
          : parsed.data.periodicLabelCode ?? null,
      apparatusMassLabelCode:
        parsed.data.apparatusMassLabelCode === undefined
          ? undefined
          : parsed.data.apparatusMassLabelCode ?? null,
      cylinderMassLabelCode:
        parsed.data.cylinderMassLabelCode === undefined
          ? undefined
          : parsed.data.cylinderMassLabelCode ?? null,
    };

    const upserted = await prisma.companyManufacturerAuthorization.upsert({
      where: {
        companyId_manufacturerId: {
          companyId: session.companyId,
          manufacturerId,
        },
      },
      update: data,
      create: {
        companyId: session.companyId,
        manufacturerId,
        ...data,
      },
    });

    const audit = extractAuditMeta(req);
    await logAudit({
      companyId: session.companyId,
      actorId: session.accountUserId,
      actorType: "ACCOUNT_USER",
      action: "companyAuthorization.upsert",
      entity: "CompanyManufacturerAuthorization",
      entityId: upserted.id,
      meta: {
        manufacturerId,
        manufacturerName: manu.name,
        active: upserted.active,
        expiresAt: upserted.expiresAt ? upserted.expiresAt.toISOString() : null,
        periodicLabelCode: upserted.periodicLabelCode,
        apparatusMassLabelCode: upserted.apparatusMassLabelCode,
        cylinderMassLabelCode: upserted.cylinderMassLabelCode,
      },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });

    return NextResponse.json({ ok: true, id: upserted.id });
  },
);
