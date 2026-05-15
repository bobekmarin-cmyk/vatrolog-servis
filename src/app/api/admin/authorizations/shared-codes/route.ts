import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { validateSharedLabelCodes } from "@/lib/labelCodeValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  periodicLabelCode: z.string().trim().max(50).nullable().optional(),
  apparatusMassLabelCode: z.string().trim().max(50).nullable().optional(),
  cylinderMassLabelCode: z.string().trim().max(50).nullable().optional(),
});

function normalize(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export const POST = apiHandler(async (req: Request) => {
  const session = await requireAdminSession();

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: {
      labelCodeStrategy: true,
      sharedPeriodicLabelCode: true,
      sharedApparatusMassLabelCode: true,
      sharedCylinderMassLabelCode: true,
    },
  });
  if (!company) {
    throw new AppValidationError("Tvrtka nije pronađena.");
  }
  if (company.labelCodeStrategy !== "SHARED") {
    throw new AppValidationError(
      "Zajedničke šifre se mogu postaviti samo u načinu \"Zajedničke šifre\". Prebaci se prvo na taj način.",
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError("Neispravan unos.");
  }

  const codes = {
    periodicLabelCode: normalize(parsed.data.periodicLabelCode),
    apparatusMassLabelCode: normalize(parsed.data.apparatusMassLabelCode),
    cylinderMassLabelCode: normalize(parsed.data.cylinderMassLabelCode),
  };

  const validation = validateSharedLabelCodes(codes);
  if (!validation.ok) {
    throw new AppValidationError(validation.reason);
  }

  // U jednoj transakciji ažuriraj Company.shared* i upiši ISTE šifre u sva
  // CompanyManufacturerAuthorization za sve proizvođače (kako bi otpremnica,
  // skladište i ostale rute koje čitaju iz CMA dobile konzistentne podatke).
  const result = await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: session.companyId },
      data: {
        sharedPeriodicLabelCode: codes.periodicLabelCode,
        sharedApparatusMassLabelCode: codes.apparatusMassLabelCode,
        sharedCylinderMassLabelCode: codes.cylinderMassLabelCode,
      },
    });

    const manus = await tx.manufacturer.findMany({ select: { id: true } });

    let upsertedCount = 0;
    for (const m of manus) {
      await tx.companyManufacturerAuthorization.upsert({
        where: {
          companyId_manufacturerId: {
            companyId: session.companyId,
            manufacturerId: m.id,
          },
        },
        create: {
          companyId: session.companyId,
          manufacturerId: m.id,
          active: false,
          periodicLabelCode: codes.periodicLabelCode,
          apparatusMassLabelCode: codes.apparatusMassLabelCode,
          cylinderMassLabelCode: codes.cylinderMassLabelCode,
        },
        update: {
          periodicLabelCode: codes.periodicLabelCode,
          apparatusMassLabelCode: codes.apparatusMassLabelCode,
          cylinderMassLabelCode: codes.cylinderMassLabelCode,
        },
      });
      upsertedCount++;
    }

    return { upsertedCount };
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "companyAuthorization.shared.upsert",
    entity: "Company",
    entityId: session.companyId,
    meta: {
      periodicLabelCode: codes.periodicLabelCode,
      apparatusMassLabelCode: codes.apparatusMassLabelCode,
      cylinderMassLabelCode: codes.cylinderMassLabelCode,
      manufacturersUpdated: result.upsertedCount,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, ...result, codes });
});
