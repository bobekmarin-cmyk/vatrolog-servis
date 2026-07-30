/**
 * Izdavanje / dohvat zamrznutih primki za radni nalog.
 * Nova se izdaje samo kad se contentKey (batchi) promijeni.
 */

import React, { type ComponentProps } from "react";
import { prisma } from "@/lib/prisma";
import { renderPdfToBuffer } from "@/lib/renderPdfToBuffer";
import PrimkaPdfDocument from "@/pdf/PrimkaPdfDocument";
import { buildPrimkaPdfData } from "@/lib/pdf/workOrderDocumentBuilders";
import { savePdf, readPdf } from "@/lib/pdfStorage";
import { buildWorkOrderPdfNames } from "@/lib/workOrderDocumentNames";
import {
  listReceiptBatches,
  receiptBatchesContentKey,
  ensureInitialReceiptBatch,
} from "@/lib/workOrderReceiptBatches";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";

export type PrimkaIssueSummary = {
  id: string;
  version: number;
  contentKey: string;
  issuedAt: Date;
  issuedAtLabel: string;
  filename: string | null;
  hasPdf: boolean;
};

export async function getCurrentPrimkaContentKey(workOrderId: string): Promise<string> {
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      companyId: true,
      receivedAt: true,
      receivedQty: true,
    },
  });
  if (!order) return "";

  await ensureInitialReceiptBatch(prisma, {
    companyId: order.companyId,
    workOrderId: order.id,
    receivedAt: order.receivedAt,
    qty: order.receivedQty,
  });

  const batches = await listReceiptBatches(prisma, workOrderId);
  return receiptBatchesContentKey(batches);
}

export async function listPrimkaIssues(workOrderId: string): Promise<PrimkaIssueSummary[]> {
  const rows = await prisma.workOrderPrimkaIssue.findMany({
    where: { workOrderId },
    orderBy: { version: "asc" },
    select: {
      id: true,
      version: true,
      contentKey: true,
      issuedAt: true,
      filename: true,
      pdfStoragePath: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    contentKey: r.contentKey,
    issuedAt: r.issuedAt,
    issuedAtLabel: formatDateDdMmYyyy(r.issuedAt),
    filename: r.filename,
    hasPdf: !!r.pdfStoragePath,
  }));
}

export async function getPrimkaIssueStatus(workOrderId: string): Promise<{
  contentKey: string;
  issues: PrimkaIssueSummary[];
  latest: PrimkaIssueSummary | null;
  canIssueNew: boolean;
}> {
  const contentKey = await getCurrentPrimkaContentKey(workOrderId);
  const issues = await listPrimkaIssues(workOrderId);
  const latest = issues.length > 0 ? issues[issues.length - 1]! : null;
  const canIssueNew = !latest || latest.contentKey !== contentKey;
  return { contentKey, issues, latest, canIssueNew };
}

/** Izdaj novu primku ako se sadržaj promijenio (ili ako još nema nijedne). */
export async function issuePrimka(workOrderId: string): Promise<{
  issueId: string;
  version: number;
  created: boolean;
  body: Buffer;
  filename: string;
}> {
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      companyId: true,
      orderNumber: true,
      company: { select: { serviceCode: true, usernameSlug: true } },
      customer: { select: { name: true, shortName: true } },
    },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const status = await getPrimkaIssueStatus(workOrderId);
  if (!status.canIssueNew && status.latest) {
    const body = await readIssuedPrimkaPdf(status.latest.id);
    return {
      issueId: status.latest.id,
      version: status.latest.version,
      created: false,
      body,
      filename: status.latest.filename ?? `primka_${order.orderNumber}.pdf`,
    };
  }

  const built = await buildPrimkaPdfData(workOrderId);
  if (!built) throw new Error("BUILD_FAILED");

  const pdfNames = buildWorkOrderPdfNames(
    {
      serviceCode: order.company.serviceCode,
      usernameSlug: order.company.usernameSlug,
    },
    {
      orderNumber: order.orderNumber,
      customer: order.customer,
    },
    "primka",
  );

  const version = (status.latest?.version ?? 0) + 1;
  const fileBase = `${pdfNames.fileBase}_v${version}`;
  const filename = `${fileBase}.pdf`;

  const props = { data: built.data } satisfies ComponentProps<typeof PrimkaPdfDocument>;
  const element = React.createElement(PrimkaPdfDocument, props);
  const bodyBuf = Buffer.from(await renderPdfToBuffer(element));

  const storagePath = await savePdf(order.companyId, "receipt", order.orderNumber, bodyBuf, {
    fileBase,
  });

  const issue = await prisma.workOrderPrimkaIssue.create({
    data: {
      companyId: order.companyId,
      workOrderId: order.id,
      version,
      contentKey: status.contentKey,
      pdfStoragePath: storagePath,
      filename,
    },
    select: { id: true, version: true },
  });

  await prisma.documentLog.create({
    data: {
      companyId: order.companyId,
      workOrderId: order.id,
      docType: "PRIMKA_ISSUED",
    },
  });

  return {
    issueId: issue.id,
    version: issue.version,
    created: true,
    body: bodyBuf,
    filename,
  };
}

export async function readIssuedPrimkaPdf(issueId: string): Promise<Buffer> {
  const issue = await prisma.workOrderPrimkaIssue.findUnique({
    where: { id: issueId },
    select: { pdfStoragePath: true },
  });
  if (!issue?.pdfStoragePath) throw new Error("PDF_MISSING");
  return readPdf(issue.pdfStoragePath);
}
