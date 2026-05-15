import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zagrebCalendarYear, buildDeliveryNoteFullNumber } from "@/lib/deliveryNoteNumber";
import { renderDeliveryNotePdfBuffer } from "@/lib/deliveryNotePdf";
import { savePdf } from "@/lib/pdfStorage";
import { buildWorkOrderPdfNames } from "@/lib/workOrderDocumentNames";

type Db = PrismaClient | Prisma.TransactionClient;

export async function getActiveDeliveryNote(
  db: Db,
  companyId: string,
  workOrderId: string,
) {
  return db.deliveryNote.findFirst({
    where: {
      companyId,
      workOrderId,
      supersededAt: null,
      pdfStoragePath: { not: null },
    },
    orderBy: { issuedAt: "desc" },
  });
}

async function nextSequenceInYear(
  tx: Prisma.TransactionClient,
  companyId: string,
  issuedAt: Date,
): Promise<{ seq: number; year: number }> {
  const year = zagrebCalendarYear(issuedAt);
  const rows = await tx.$queryRaw<{ lastSeq: number }[]>`
    INSERT INTO "DeliveryNoteYearCounter" ("companyId", "year", "lastSeq")
    VALUES (${companyId}, ${year}, 1)
    ON CONFLICT ("companyId", "year")
    DO UPDATE SET "lastSeq" = "DeliveryNoteYearCounter"."lastSeq" + 1
    RETURNING "lastSeq"
  `;
  const seq = rows[0]?.lastSeq;
  if (typeof seq !== "number" || Number.isNaN(seq)) {
    throw new Error("DELIVERY_NOTE_SEQ_FAILED");
  }
  return { seq, year };
}

export type IssueDeliveryNoteResult = {
  deliveryNoteId: string;
  number: string;
  pdfStoragePath: string;
};

/**
 * Izdaje otpremnicu (prvu ili zamjensku). Zamjena: tek nakon uspješnog PDF-a
 * stara aktivna otpremnica dobije supersededAt.
 */
export async function issueDeliveryNoteForWorkOrder(options: {
  workOrderId: string;
  companyId: string;
  accountUserId: string | null;
  issueKind: "first" | "reissue";
  db?: PrismaClient;
}): Promise<IssueDeliveryNoteResult> {
  const db = options.db ?? prisma;
  const issuedAt = new Date();

  const { order, draftRow, previousActiveId } = await db.$transaction(async (tx) => {
    const orderRow = await tx.workOrder.findFirst({
      where: { id: options.workOrderId, companyId: options.companyId },
      include: { company: true },
    });
    if (!orderRow || orderRow.status !== "LOCKED") {
      throw new Error("NOT_LOCKED");
    }

    const active = await getActiveDeliveryNote(tx, options.companyId, orderRow.id);
    if (options.issueKind === "first" && active) {
      throw new Error("ALREADY_ISSUED");
    }
    if (options.issueKind === "reissue" && !active) {
      throw new Error("NOTHING_TO_SUPERSEDE");
    }

    const { seq, year } = await nextSequenceInYear(tx, options.companyId, issuedAt);
    const { number } = buildDeliveryNoteFullNumber(orderRow.company, issuedAt, seq);

    const draft = await tx.deliveryNote.create({
      data: {
        companyId: options.companyId,
        workOrderId: orderRow.id,
        number,
        year,
        seq,
        issuedAt,
        issuedByAccountUserId: options.accountUserId,
        pdfStoragePath: null,
      },
    });

    return {
      order: orderRow,
      draftRow: draft,
      previousActiveId: options.issueKind === "reissue" && active ? active.id : null,
    };
  });

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderDeliveryNotePdfBuffer(db, options.companyId, options.workOrderId, {
      docId: draftRow.number,
      deliveryNoteAt: issuedAt,
      generatedAt: issuedAt,
    });
  } catch (e) {
    await db.deliveryNote.delete({ where: { id: draftRow.id } }).catch(() => {});
    throw e;
  }

  const customer = await db.customer.findUniqueOrThrow({
    where: { id: order.customerId },
  });

  const pdfNames = buildWorkOrderPdfNames(
    {
      serviceCode: order.company.serviceCode,
      usernameSlug: order.company.usernameSlug,
    },
    {
      orderNumber: order.orderNumber,
      customer,
    },
    "otpremnica",
  );

  const fileBase = `dn_${draftRow.number.replace(/[^a-zA-Z0-9]+/g, "_")}_${pdfNames.fileBase}`;

  let pdfStoragePath: string;
  try {
    pdfStoragePath = await savePdf(options.companyId, "delivery-note", order.orderNumber, pdfBuffer, {
      fileBase,
    });
  } catch (e) {
    await db.deliveryNote.delete({ where: { id: draftRow.id } }).catch(() => {});
    throw e;
  }

  await db.$transaction(async (tx) => {
    await tx.deliveryNote.update({
      where: { id: draftRow.id },
      data: { pdfStoragePath },
    });
    if (previousActiveId) {
      await tx.deliveryNote.update({
        where: { id: previousActiveId },
        data: { supersededAt: issuedAt },
      });
    }
  });

  await db.documentLog
    .create({
      data: {
        companyId: options.companyId,
        workOrderId: options.workOrderId,
        docType: "DELIVERY_NOTE_PDF",
      },
    })
    .catch(() => {});

  return {
    deliveryNoteId: draftRow.id,
    number: draftRow.number,
    pdfStoragePath,
  };
}
