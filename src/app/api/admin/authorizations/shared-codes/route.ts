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
  //
  // Implementacija: updateMany za postojeće retke + createMany za nedostajuće.
  // Stari sekvencijalni upsert za 31 proizvođača je prelazio Prisma default
  // timeout (5s) pa je vraćao 500.
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.company.update({
        where: { id: session.companyId },
        data: {
          sharedPeriodicLabelCode: codes.periodicLabelCode,
          sharedApparatusMassLabelCode: codes.apparatusMassLabelCode,
          sharedCylinderMassLabelCode: codes.cylinderMassLabelCode,
        },
      });

      const updateResult = await tx.companyManufacturerAuthorization.updateMany({
        where: { companyId: session.companyId },
        data: {
          periodicLabelCode: codes.periodicLabelCode,
          apparatusMassLabelCode: codes.apparatusMassLabelCode,
          cylinderMassLabelCode: codes.cylinderMassLabelCode,
        },
      });

      const [existing, allManus] = await Promise.all([
        tx.companyManufacturerAuthorization.findMany({
          where: { companyId: session.companyId },
          select: { manufacturerId: true },
        }),
        tx.manufacturer.findMany({ select: { id: true } }),
      ]);
      const have = new Set(existing.map((e) => e.manufacturerId));
      const missing = allManus.filter((m) => !have.has(m.id)).map((m) => m.id);

      let created = 0;
      if (missing.length > 0) {
        const r = await tx.companyManufacturerAuthorization.createMany({
          data: missing.map((manufacturerId) => ({
            companyId: session.companyId,
            manufacturerId,
            active: false,
            periodicLabelCode: codes.periodicLabelCode,
            apparatusMassLabelCode: codes.apparatusMassLabelCode,
            cylinderMassLabelCode: codes.cylinderMassLabelCode,
          })),
          skipDuplicates: true,
        });
        created = r.count;
      }

      return { upsertedCount: updateResult.count + created, updated: updateResult.count, created };
    },
    { timeout: 30000 },
  );

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
      updated: result.updated,
      created: result.created,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, ...result, codes });
});
