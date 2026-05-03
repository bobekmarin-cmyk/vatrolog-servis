import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const itemSchema = z.object({
  partId: z.string().min(5).max(60),
  quantity: z.coerce.number().int().positive().max(100000),
  unitPrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
});

const schema = z.object({
  receiptDate: z.coerce.date(),
  supplierName: z.string().trim().min(1).max(200),
  reference: z.string().trim().max(300).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  items: z.array(itemSchema).min(1, "Primka mora imati barem jednu stavku."),
});

async function generateReceiptNumber(companyId: string, year: number): Promise<string> {
  const prefix = `SP-${year}`;
  const count = await prisma.stockReceipt.count({
    where: { companyId, number: { startsWith: prefix } },
  });
  const serial = String(count + 1).padStart(4, "0");
  return `${prefix}${serial}`;
}

export const POST = apiHandler(async (req: Request) => {
  const session = await requireActiveSession();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".")] = issue.message;
    }
    throw new AppValidationError("Neispravan unos.", fields);
  }

  const { items } = parsed.data;
  const partIds = Array.from(new Set(items.map((i) => i.partId)));
  const parts = await prisma.part.findMany({
    where: {
      id: { in: partIds },
      active: true,
      OR: [{ companyId: null }, { companyId: session.companyId }],
    },
    select: { id: true },
  });
  if (parts.length !== partIds.length) {
    throw new AppValidationError("Jedan ili više odabranih dijelova ne postoje ili vam nisu dostupni.");
  }

  const year = parsed.data.receiptDate.getFullYear();
  const number = await generateReceiptNumber(session.companyId, year);

  const created = await prisma.$transaction(async (tx) => {
    const receipt = await tx.stockReceipt.create({
      data: {
        companyId: session.companyId,
        number,
        receiptDate: parsed.data.receiptDate,
        supplierName: parsed.data.supplierName,
        reference: parsed.data.reference?.trim() ? parsed.data.reference.trim() : null,
        note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
        createdById: session.accountUserId,
        items: {
          create: items.map((i) => ({
            partId: i.partId,
            quantity: i.quantity,
            unitPrice: i.unitPrice ?? null,
          })),
        },
      },
      select: { id: true, number: true },
    });

    // Agregiraj po partId (ako je isti dio u više stavki).
    const totals = new Map<string, number>();
    for (const i of items) {
      totals.set(i.partId, (totals.get(i.partId) ?? 0) + i.quantity);
    }

    for (const [partId, qty] of totals) {
      await tx.partStock.upsert({
        where: { companyId_partId: { companyId: session.companyId, partId } },
        create: {
          companyId: session.companyId,
          partId,
          stockQty: qty,
          minStockQty: 0,
        },
        update: {
          stockQty: { increment: qty },
        },
      });
    }

    return receipt;
  });

  const audit = extractAuditMeta(req);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "stockReceipt.create",
    entity: "StockReceipt",
    entityId: created.id,
    meta: { number: created.number, itemCount: items.length, totalQty, supplier: parsed.data.supplierName },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, id: created.id, number: created.number });
});
