import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  partId: z.string().min(5).max(60),
  /** Tenantova računovodstvena šifra (može biti null = brisanje override šifre). */
  code: z.string().trim().max(60).nullable().optional(),
  /** Tenantova cijena (EUR). */
  price: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const num = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      if (!Number.isFinite(num) || num < 0) return null;
      return Math.round(num * 100) / 100;
    }),
  /** Tenant aktivacija — ako se izostavi, ne mijenjamo postojeći status. */
  active: z.boolean().optional(),
});

/**
 * Upsert tenantovog overridea za platform dio:
 *  - vlastita (računovodstvena) šifra
 *  - vlastita cijena
 *  - aktivacija/deaktivacija pojedinog platform dijela na razini tenanta
 *
 * Validira da je `partId` doista platform dio (Part.companyId IS NULL).
 */
export const POST = apiHandler(async (req: Request) => {
  const session = await requireAdminSession();

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError("Neispravan unos.");
  }

  const part = await prisma.part.findUnique({
    where: { id: parsed.data.partId },
    select: { id: true, companyId: true, manufacturerId: true, code: true, name: true },
  });
  if (!part) throw new AppValidationError("Dio ne postoji.");
  if (part.companyId !== null) {
    throw new AppValidationError("Override se može postaviti samo za dijelove iz kataloga proizvođača.");
  }

  // Pripremi podatke za upsert. Ako `active` nije proslijeđen, zadrži postojeći.
  const code = parsed.data.code ?? null;
  const price = parsed.data.price ?? null;

  const existing = await prisma.companyPartOverride.findUnique({
    where: { companyId_partId: { companyId: session.companyId, partId: part.id } },
    select: { id: true, active: true },
  });

  const nextActive = parsed.data.active ?? existing?.active ?? true;

  const up = await prisma.companyPartOverride.upsert({
    where: { companyId_partId: { companyId: session.companyId, partId: part.id } },
    create: {
      companyId: session.companyId,
      partId: part.id,
      code: code && code.length > 0 ? code : null,
      price,
      active: nextActive,
    },
    update: {
      ...(parsed.data.code !== undefined ? { code: code && code.length > 0 ? code : null } : {}),
      ...(parsed.data.price !== undefined ? { price } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    },
    select: { id: true, code: true, price: true, active: true },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "partCatalog.platformOverrideUpsert",
    entity: "CompanyPartOverride",
    entityId: up.id,
    meta: {
      partId: part.id,
      manufacturerId: part.manufacturerId,
      code: up.code,
      price: up.price?.toString() ?? null,
      active: up.active,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({
    ok: true,
    code: up.code,
    price: up.price ? Number(up.price) : null,
    active: up.active,
  });
});
