import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const itemSchema = z.object({
  serviceLabelId: z.string().min(5).max(60),
  quantity: z.coerce.number().int().positive().max(1_000_000),
});

/**
 * Servisne naljepnice se uvijek naručuju od MUP-a, pa dobavljač nije
 * korisnički unos – fiksno se zapisuje na serveru.
 */
const DEFAULT_LABEL_SUPPLIER = "MUP RH";

const schema = z.object({
  receiptDate: z.coerce.date(),
  reference: z.string().trim().max(300).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  items: z.array(itemSchema).min(1, "Primka mora imati barem jednu stavku."),
});

async function generateReceiptNumber(companyId: string, year: number): Promise<string> {
  const prefix = `SL-${year}`;
  const count = await prisma.serviceLabelReceipt.count({
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
  const labelIds = Array.from(new Set(items.map((i) => i.serviceLabelId)));
  const labels = await prisma.serviceLabel.findMany({
    where: { id: { in: labelIds } },
    select: { id: true },
  });
  if (labels.length !== labelIds.length) {
    throw new AppValidationError("Jedna ili više odabranih naljepnica ne postoje.");
  }

  const year = parsed.data.receiptDate.getFullYear();
  const number = await generateReceiptNumber(session.companyId, year);

  const created = await prisma.$transaction(async (tx) => {
    const receipt = await tx.serviceLabelReceipt.create({
      data: {
        companyId: session.companyId,
        number,
        receiptDate: parsed.data.receiptDate,
        supplierName: DEFAULT_LABEL_SUPPLIER,
        reference: parsed.data.reference?.trim() ? parsed.data.reference.trim() : null,
        note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
        createdById: session.accountUserId,
        items: {
          create: items.map((i) => ({
            serviceLabelId: i.serviceLabelId,
            quantity: i.quantity,
          })),
        },
      },
      select: { id: true, number: true },
    });

    const totals = new Map<string, number>();
    for (const i of items) {
      totals.set(i.serviceLabelId, (totals.get(i.serviceLabelId) ?? 0) + i.quantity);
    }

    for (const [serviceLabelId, qty] of totals) {
      await tx.serviceLabelStock.upsert({
        where: {
          companyId_serviceLabelId: {
            companyId: session.companyId,
            serviceLabelId,
          },
        },
        create: {
          companyId: session.companyId,
          serviceLabelId,
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
    action: "serviceLabelReceipt.create",
    entity: "ServiceLabelReceipt",
    entityId: created.id,
    meta: {
      number: created.number,
      itemCount: items.length,
      totalQty,
      supplier: DEFAULT_LABEL_SUPPLIER,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, id: created.id, number: created.number });
});
