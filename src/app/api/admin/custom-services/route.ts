import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1, "Naziv je obavezan.").max(120),
  code: z.string().trim().max(50).nullable().optional(),
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
});

export const POST = apiHandler(async (req: Request) => {
  const session = await requireAdminSession();

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError(parsed.error.issues[0]?.message ?? "Neispravan unos.");
  }

  const name = parsed.data.name;
  const code = (parsed.data.code ?? null)?.trim() || null;
  const price = parsed.data.price ?? null;

  const existing = await prisma.companyCustomService.findFirst({
    where: { companyId: session.companyId, name, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw new AppValidationError("Usluga s tim nazivom već postoji.");
  }

  const created = await prisma.companyCustomService.create({
    data: {
      companyId: session.companyId,
      name,
      code,
      price,
    },
    select: { id: true, name: true, code: true, price: true },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "customService.create",
    entity: "CompanyCustomService",
    entityId: created.id,
    meta: { name: created.name, code: created.code, price: created.price?.toString() ?? null },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({
    ok: true,
    id: created.id,
    name: created.name,
    code: created.code,
    price: created.price ? Number(created.price) : null,
  });
});
