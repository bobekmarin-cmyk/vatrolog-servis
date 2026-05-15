import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { validateLabelCodesPerManufacturer } from "@/lib/labelCodeValidation";
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

    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { labelCodeStrategy: true },
    });
    if (!company) {
      throw new AppValidationError("Tvrtka nije pronađena.");
    }

    const codesProvided =
      parsed.data.periodicLabelCode !== undefined ||
      parsed.data.apparatusMassLabelCode !== undefined ||
      parsed.data.cylinderMassLabelCode !== undefined;

    // U SHARED modu sustav ne dozvoljava per-manufacturer unos šifri — one se
    // postavljaju kroz /api/admin/authorizations/shared-codes.
    if (company.labelCodeStrategy === "SHARED" && codesProvided) {
      throw new AppValidationError(
        "U načinu \"Zajedničke šifre\" pojedinačne šifre po proizvođaču nisu dozvoljene. Koristi obrazac za zajedničke šifre.",
      );
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

    // U PER_MANUFACTURER modu validiraj cijeli efektivni set (kombinacija
    // postojeće vrijednosti + nova ako ju korisnik šalje).
    if (company.labelCodeStrategy === "PER_MANUFACTURER") {
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

      const validation = await validateLabelCodesPerManufacturer(prisma, {
        companyId: session.companyId,
        manufacturerId,
        codes: effectiveCodes,
      });
      if (!validation.ok) {
        throw new AppValidationError(validation.reason);
      }
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
        strategy: company.labelCodeStrategy,
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
