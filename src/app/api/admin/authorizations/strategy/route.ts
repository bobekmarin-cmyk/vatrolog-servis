import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  strategy: z.enum(["SHARED", "PER_MANUFACTURER"]),
  /** Korisnik je potvrdio brisanje postojećih per-manufacturer šifri pri prelasku iz PER_MANUFACTURER u SHARED. */
  confirmClear: z.boolean().optional(),
});

export const POST = apiHandler(async (req: Request) => {
  const session = await requireAdminSession();

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError("Neispravan unos.");
  }

  const { strategy, confirmClear } = parsed.data;

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

  if (company.labelCodeStrategy === strategy) {
    return NextResponse.json({ ok: true, strategy, noChange: true });
  }

  // PER_MANUFACTURER -> SHARED:
  //   ako postoje per-manu šifre, treba confirmClear=true; tada ih sve brišemo.
  // SHARED -> PER_MANUFACTURER:
  //   per-manu šifre su već null (jer u SHARED modu nismo dozvolili unos),
  //   ali za svaki slučaj informativno čitamo i brišemo i shared šifre na company-ju.
  let perManuCleared = 0;
  let sharedCleared = false;

  if (strategy === "SHARED" && company.labelCodeStrategy === "PER_MANUFACTURER") {
    const existingCount = await prisma.companyManufacturerAuthorization.count({
      where: {
        companyId: session.companyId,
        OR: [
          { periodicLabelCode: { not: null } },
          { apparatusMassLabelCode: { not: null } },
          { cylinderMassLabelCode: { not: null } },
        ],
      },
    });

    if (existingCount > 0 && !confirmClear) {
      // Vrati 409 sa flagom da klijent zna prikazati confirm modal.
      return NextResponse.json(
        {
          error:
            `Postoje postojeće šifre za ${existingCount} proizvođača. Prebacivanjem u zajednički način šifriranja sve će biti obrisane. Potvrdi za nastavak.`,
          code: "CONFIRM_REQUIRED",
          existingCount,
        },
        { status: 409 },
      );
    }

    if (existingCount > 0) {
      const updated = await prisma.companyManufacturerAuthorization.updateMany({
        where: { companyId: session.companyId },
        data: {
          periodicLabelCode: null,
          apparatusMassLabelCode: null,
          cylinderMassLabelCode: null,
        },
      });
      perManuCleared = updated.count;
    }
  }

  if (strategy === "PER_MANUFACTURER") {
    // Ako su prije bile postavljene shared šifre, brišemo ih (u PER_MANUFACTURER
    // modu nisu izvor istine i mogu zbuniti).
    if (
      company.sharedPeriodicLabelCode ||
      company.sharedApparatusMassLabelCode ||
      company.sharedCylinderMassLabelCode
    ) {
      sharedCleared = true;
    }
  }

  await prisma.company.update({
    where: { id: session.companyId },
    data: {
      labelCodeStrategy: strategy,
      ...(sharedCleared && {
        sharedPeriodicLabelCode: null,
        sharedApparatusMassLabelCode: null,
        sharedCylinderMassLabelCode: null,
      }),
    },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "companyAuthorization.strategy.change",
    entity: "Company",
    entityId: session.companyId,
    meta: {
      from: company.labelCodeStrategy,
      to: strategy,
      perManuCleared,
      sharedCleared,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({
    ok: true,
    strategy,
    perManuCleared,
    sharedCleared,
  });
});
