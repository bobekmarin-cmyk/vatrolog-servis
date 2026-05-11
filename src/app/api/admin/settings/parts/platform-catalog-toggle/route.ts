import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  manufacturerId: z.string().min(5).max(60),
  usePlatformCatalog: z.boolean(),
});

/**
 * Uključi/isključi preddefinirani (platform) katalog rezervnih dijelova
 * za jednog proizvođača. Tenant mora imati aktivno ovlaštenje za tog
 * proizvođača (CompanyManufacturerAuthorization.active = true).
 */
export const POST = apiHandler(async (req: Request) => {
  const session = await requireAdminSession();

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError("Neispravan unos.");
  }

  const { manufacturerId, usePlatformCatalog } = parsed.data;

  const auth = await prisma.companyManufacturerAuthorization.findFirst({
    where: { companyId: session.companyId, manufacturerId, active: true },
    select: { id: true },
  });
  if (!auth) {
    throw new AppValidationError("Nemate aktivno ovlaštenje za tog proizvođača.");
  }

  const up = await prisma.companyPartCatalogSetting.upsert({
    where: { companyId_manufacturerId: { companyId: session.companyId, manufacturerId } },
    create: {
      companyId: session.companyId,
      manufacturerId,
      usePlatformCatalog,
    },
    update: { usePlatformCatalog },
    select: { id: true, usePlatformCatalog: true },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "partCatalog.platformToggle",
    entity: "CompanyPartCatalogSetting",
    entityId: up.id,
    meta: { manufacturerId, usePlatformCatalog: up.usePlatformCatalog },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, usePlatformCatalog: up.usePlatformCatalog });
});
