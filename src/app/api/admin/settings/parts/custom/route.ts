import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  /** Null = create, string = update postojećeg vlastitog dijela. */
  partId: z.string().min(5).max(60).nullable().optional(),
  manufacturerId: z.string().min(5).max(60),
  code: z.string().trim().min(1, "Šifra je obavezna.").max(60),
  name: z.string().trim().min(1, "Naziv je obavezan.").max(200),
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
  active: z.boolean().optional(),
  typeIds: z.array(z.string().min(5).max(60)).min(1, "Odaberite barem jedan tip aparata."),
});

/**
 * Create/update vlastitog (tenant) rezervnog dijela.
 *
 *  - Validira da proizvođač ima ovlaštenje od strane tenanta i da odabrani
 *    tipovi aparata pripadaju tom proizvođaču.
 *  - Šifra mora biti jedinstvena za tu kombinaciju (manufacturerId, companyId).
 */
export const POST = apiHandler(async (req: Request) => {
  const session = await requireAdminSession();

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError(parsed.error.issues[0]?.message ?? "Neispravan unos.");
  }

  const { partId, manufacturerId, code, name, typeIds } = parsed.data;
  const price = parsed.data.price ?? null;
  const active = parsed.data.active ?? true;

  const auth = await prisma.companyManufacturerAuthorization.findFirst({
    where: { companyId: session.companyId, manufacturerId, active: true },
    select: { id: true },
  });
  if (!auth) {
    throw new AppValidationError("Nemate aktivno ovlaštenje za tog proizvođača.");
  }

  const mfLinks = await prisma.manufacturerExtinguisherType.findMany({
    where: { manufacturerId, extinguisherTypeId: { in: typeIds } },
    select: { extinguisherTypeId: true },
  });
  const validIds = new Set(mfLinks.map((x) => x.extinguisherTypeId));
  if (typeIds.some((id) => !validIds.has(id))) {
    throw new AppValidationError("Neki odabrani tipovi ne pripadaju ovom proizvođaču.");
  }

  // Šifra mora biti jedinstvena na razini cijele tvrtke (preko svih proizvođača).
  const conflict = await prisma.part.findFirst({
    where: {
      companyId: session.companyId,
      code,
      ...(partId ? { id: { not: partId } } : {}),
    },
    select: {
      id: true,
      name: true,
      manufacturer: { select: { name: true, displayName: true } },
    },
  });
  if (conflict) {
    const manuName =
      conflict.manufacturer.displayName?.trim() ||
      conflict.manufacturer.name?.trim() ||
      "—";
    throw new AppValidationError(
      `Šifra „${code}" je već u upotrebi: ${manuName} — ${conflict.name}. Odaberite drugu šifru.`,
    );
  }

  const audit = extractAuditMeta(req);

  if (!partId) {
    try {
      const created = await prisma.part.create({
        data: {
          manufacturerId,
          companyId: session.companyId,
          code,
          name,
          active,
          defaultPrice: price,
          types: { create: typeIds.map((tid) => ({ extinguisherTypeId: tid })) },
        },
        select: { id: true, code: true, name: true },
      });

      await logAudit({
        companyId: session.companyId,
        actorId: session.accountUserId,
        actorType: "ACCOUNT_USER",
        action: "part.customCreate",
        entity: "Part",
        entityId: created.id,
        meta: { manufacturerId, code: created.code, name: created.name, price: price?.toString() ?? null },
        ip: audit.ip,
        userAgent: audit.userAgent,
      });

      return NextResponse.json({ ok: true, id: created.id });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Unique constraint") || msg.toLowerCase().includes("unique")) {
        throw new AppValidationError("Već imate dio s tom šifrom za ovog proizvođača.");
      }
      throw e;
    }
  }

  const existing = await prisma.part.findUnique({
    where: { id: partId },
    select: { id: true, companyId: true, manufacturerId: true, code: true, name: true },
  });
  if (!existing || existing.companyId !== session.companyId) {
    throw new AppValidationError("Dio ne postoji ili nije vaš vlastiti dio.");
  }
  if (existing.manufacturerId !== manufacturerId) {
    throw new AppValidationError("Promjena proizvođača nije dozvoljena za postojeći dio.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.part.update({
        where: { id: partId },
        data: {
          code,
          name,
          active,
          defaultPrice: price,
        },
      });
      await tx.partExtinguisherType.deleteMany({ where: { partId } });
      await tx.partExtinguisherType.createMany({
        data: typeIds.map((tid) => ({ partId, extinguisherTypeId: tid })),
        skipDuplicates: true,
      });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.toLowerCase().includes("unique")) {
      throw new AppValidationError("Već imate dio s tom šifrom za ovog proizvođača.");
    }
    throw e;
  }

  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "part.customUpdate",
    entity: "Part",
    entityId: partId,
    meta: { manufacturerId, code, name, price: price?.toString() ?? null, active },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, id: partId });
});
