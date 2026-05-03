import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().max(50).nullable().optional(),
  price: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const num = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      if (!Number.isFinite(num) || num < 0) return null;
      return Math.round(num * 100) / 100;
    }),
  isActive: z.boolean().optional(),
});

export const PATCH = apiHandler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError(parsed.error.issues[0]?.message ?? "Neispravan unos.");
  }

  const row = await prisma.companyCustomService.findFirst({
    where: { id, companyId: session.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new AppValidationError("Usluga nije pronađena.");

  const data: {
    name?: string;
    code?: string | null;
    price?: number | null;
    isActive?: boolean;
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.code !== undefined) {
    const c = parsed.data.code?.trim() ?? null;
    data.code = c && c.length > 0 ? c : null;
  }
  if (parsed.data.price !== undefined) data.price = parsed.data.price;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

  if (data.name) {
    const dup = await prisma.companyCustomService.findFirst({
      where: {
        companyId: session.companyId,
        name: data.name,
        deletedAt: null,
        NOT: { id },
      },
      select: { id: true },
    });
    if (dup) throw new AppValidationError("Usluga s tim nazivom već postoji.");
  }

  const updated = await prisma.companyCustomService.update({
    where: { id },
    data,
    select: { id: true, name: true, code: true, price: true, isActive: true },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "customService.update",
    entity: "CompanyCustomService",
    entityId: updated.id,
    meta: {
      name: updated.name,
      code: updated.code,
      price: updated.price?.toString() ?? null,
      isActive: updated.isActive,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({
    ok: true,
    id: updated.id,
    name: updated.name,
    code: updated.code,
    price: updated.price ? Number(updated.price) : null,
    isActive: updated.isActive,
  });
});
