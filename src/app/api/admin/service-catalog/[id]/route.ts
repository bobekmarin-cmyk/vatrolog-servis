import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  code: z.string().trim().max(50).nullable().optional(),
  price: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const num = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      if (!Number.isFinite(num) || num < 0) return null;
      return Math.round(num * 100) / 100;
    }),
});

export const PATCH = apiHandler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError("Neispravan unos.");
  }

  const row = await prisma.companyServiceCatalog.findFirst({
    where: { id, companyId: session.companyId },
    select: {
      id: true,
      constructionId: true,
      capacity: true,
      capacityUnit: true,
      kind: true,
      fallbackLabel: true,
    },
  });
  if (!row) {
    throw new AppValidationError("Stavka kataloga nije pronađena.");
  }

  const nextCode =
    parsed.data.code === undefined
      ? undefined
      : parsed.data.code === null
        ? null
        : parsed.data.code.length === 0
          ? null
          : parsed.data.code;

  const priceIn = parsed.data.price;

  // Pravilo dijeljenja šifre: ista `code` vrijednost smije se ponoviti unutar
  // iste tvrtke samo ako se u svim retcima poklapa (constructionId, capacity,
  // capacityUnit, kind). Za fallback retke (bez construction/capacity) traži
  // se i poklapanje fallbackLabel-a. Agent smije biti različit.
  if (nextCode !== undefined && nextCode != null) {
    const siblings = await prisma.companyServiceCatalog.findMany({
      where: {
        companyId: session.companyId,
        code: nextCode,
        NOT: { id: row.id },
      },
      select: {
        constructionId: true,
        capacity: true,
        capacityUnit: true,
        kind: true,
        fallbackLabel: true,
      },
    });

    const conflict = siblings.find((s) => {
      if (s.kind !== row.kind) return true;
      if (s.constructionId !== row.constructionId) return true;
      if (s.capacity !== row.capacity) return true;
      if (s.capacityUnit !== row.capacityUnit) return true;
      if (s.constructionId == null && s.fallbackLabel !== row.fallbackLabel) {
        return true;
      }
      return false;
    });

    if (conflict) {
      throw new AppValidationError(
        "Ovu šifru već koristi druga vrsta usluge (druga izvedba, kapacitet ili tip pregleda). Ista šifra dozvoljena je samo između aparata iste izvedbe i kapaciteta koji se razlikuju samo po mediju punjenja.",
      );
    }
  }

  const updateData: { code?: string | null; price?: number | null } = {};
  if (nextCode !== undefined) updateData.code = nextCode;
  if (priceIn !== undefined) updateData.price = priceIn;

  if (Object.keys(updateData).length === 0) {
    throw new AppValidationError("Nema izmjena za spremiti.");
  }

  const updated = await prisma.companyServiceCatalog.update({
    where: { id: row.id },
    data: updateData,
    select: { id: true, code: true, price: true, variantKey: true, kind: true },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "serviceCatalog.update",
    entity: "CompanyServiceCatalog",
    entityId: updated.id,
    meta: {
      variantKey: updated.variantKey,
      kind: updated.kind,
      code: updated.code,
      price: updated.price?.toString() ?? null,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({
    ok: true,
    id: updated.id,
    code: updated.code,
    price: updated.price != null ? Number(updated.price) : null,
  });
});
