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
  /** true = uobičajen (brzi izbornik), false = ukloni iz uobičajenih. */
  common: z.boolean(),
});

/**
 * Tenant favorizira / uklanja favorit dijela za brzi izbornik na upisniku.
 *
 *  - Platform dio → `CompanyPartOverride.common` (eksplicitni override)
 *  - Vlastiti dio → `Part.common` (živi na tenantovom Part zapisu)
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
    select: {
      id: true,
      companyId: true,
      manufacturerId: true,
      code: true,
      name: true,
      common: true,
    },
  });
  if (!part) throw new AppValidationError("Dio ne postoji.");

  const isCustom = part.companyId === session.companyId;
  const isPlatform = part.companyId === null;
  if (!isCustom && !isPlatform) {
    throw new AppValidationError("Dio ne pripada vašem katalogu.");
  }

  const audit = extractAuditMeta(req);
  const nextCommon = parsed.data.common;

  if (isCustom) {
    await prisma.part.update({
      where: { id: part.id },
      data: { common: nextCommon },
    });
    await logAudit({
      companyId: session.companyId,
      actorId: session.accountUserId,
      actorType: "ACCOUNT_USER",
      action: "partCatalog.favoriteToggle",
      entity: "Part",
      entityId: part.id,
      meta: { source: "CUSTOM", common: nextCommon },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });
    return NextResponse.json({ ok: true, common: nextCommon, source: "CUSTOM" });
  }

  const existing = await prisma.companyPartOverride.findUnique({
    where: { companyId_partId: { companyId: session.companyId, partId: part.id } },
    select: { id: true, active: true, code: true, price: true },
  });

  const up = await prisma.companyPartOverride.upsert({
    where: { companyId_partId: { companyId: session.companyId, partId: part.id } },
    create: {
      companyId: session.companyId,
      partId: part.id,
      code: null,
      price: null,
      active: true,
      common: nextCommon,
    },
    update: {
      common: nextCommon,
    },
    select: { id: true, common: true },
  });

  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "partCatalog.favoriteToggle",
    entity: "CompanyPartOverride",
    entityId: up.id,
    meta: {
      source: "PLATFORM",
      partId: part.id,
      manufacturerId: part.manufacturerId,
      common: nextCommon,
      hadOverride: !!existing,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, common: nextCommon, source: "PLATFORM" });
});
