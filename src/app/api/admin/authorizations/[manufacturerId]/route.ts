import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { validateLabelCodes } from "@/lib/labelCodeValidation";
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

    // Učitaj postojeće šifre da bismo mogli validirati i polja koja korisnik
    // nije poslao (undefined → ostavi staru vrijednost). Ako ovo nije prvi
    // upsert, naredne tri šifre čitamo iz baze.
    const previous = await prisma.companyManufacturerAuthorization.findUnique({
      where: {
        companyId_manufacturerId: {
          companyId: session.companyId,
          manufacturerId,
        },
      },
      select: {
        periodicLabelCode: true,
        apparatusMassLabelCode: true,
        cylinderMassLabelCode: true,
      },
    });

    const effectiveCodes = {
      periodicLabelCode:
        data.periodicLabelCode === undefined
          ? previous?.periodicLabelCode ?? null
          : data.periodicLabelCode,
      apparatusMassLabelCode:
        data.apparatusMassLabelCode === undefined
          ? previous?.apparatusMassLabelCode ?? null
          : data.apparatusMassLabelCode,
      cylinderMassLabelCode:
        data.cylinderMassLabelCode === undefined
          ? previous?.cylinderMassLabelCode ?? null
          : data.cylinderMassLabelCode,
    };

    const validation = await validateLabelCodes(prisma, {
      companyId: session.companyId,
      manufacturerId,
      codes: effectiveCodes,
    });
    if (!validation.ok) {
      throw new AppValidationError(validation.reason);
    }

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
