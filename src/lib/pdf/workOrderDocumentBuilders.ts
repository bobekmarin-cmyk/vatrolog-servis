import React, { type ComponentProps } from "react";
import { prisma } from "@/lib/prisma";
import { formatExtinguisherTypeParts } from "@/lib/formatExtinguisherType";
import { renderPdfToBuffer } from "@/lib/renderPdfToBuffer";
import PrimkaPdfDocument, { type PrimkaPdfData } from "@/pdf/PrimkaPdfDocument";
import RegisterPdfDocument, { type RegisterPdfData } from "@/pdf/RegisterPdfDocument";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { savePdf } from "@/lib/pdfStorage";
import QRCode from "qrcode";
import { APP_VERSION } from "@/lib/appVersion";
import { describeWorkOrderServiceContext } from "@/lib/workOrderDeliveryDisplay";
import {
  buildPrimkaReceiptLines,
  buildPrimkaReceiptLinesFromBatches,
} from "@/lib/primkaDeliveryLines";
import { buildWorkOrderPdfNames } from "@/lib/workOrderDocumentNames";
import {
  ensureInitialReceiptBatch,
  listReceiptBatches,
} from "@/lib/workOrderReceiptBatches";
import { WORK_ORDER_ITEM_ORDER_BY, workOrderItemRbr } from "@/lib/workOrderItemOrder";

/**
 * Zajedničko generiranje PDF-a primke i upisnika za jedan radni nalog. Koristi
 * ga i serviser (company ruta) i Korisnički portal — pozivatelj prvo provjeri
 * pristup, builder samo gradi i loggira dokument.
 */

export type BuiltPdf = { body: Buffer; filename: string; companyId: string };

/** Samo struktura PrimkaPdfData (bez rendera / loga) — za izdavanje zamrznute primke. */
export async function buildPrimkaPdfData(
  workOrderId: string,
): Promise<{ data: PrimkaPdfData; companyId: string; filename: string; fileBase: string } | null> {
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      company: true,
      customer: true,
      department: true,
      serviceLocation: { select: { kind: true, label: true } },
      items: {
        orderBy: WORK_ORDER_ITEM_ORDER_BY,
        include: {
          extinguisher: {
            include: { manufacturer: true, type: { include: { agent: true, construction: true } } },
          },
        },
      },
    },
  });

  if (!order) return null;

  await ensureInitialReceiptBatch(prisma, {
    companyId: order.companyId,
    workOrderId: order.id,
    receivedAt: order.receivedAt,
    qty: order.receivedQty,
  });

  const pdfNames = buildWorkOrderPdfNames(
    { serviceCode: order.company.serviceCode, usernameSlug: order.company.usernameSlug },
    { orderNumber: order.orderNumber, customer: order.customer },
    "primka",
  );
  const docId = pdfNames.docId;

  const now = new Date();

  const batches = await listReceiptBatches(prisma, order.id);
  const receiptLines =
    batches.length > 0
      ? buildPrimkaReceiptLinesFromBatches(batches, order.receivedAt)
      : buildPrimkaReceiptLines(
          order.items.map((i) => ({
            fromInitialReceipt: i.fromInitialReceipt,
            createdAt: i.createdAt,
          })),
          order.receivedAt,
        );
  const unidentifiedPlaceholderCount = order.items.filter((i) => i.isPlaceholder).length;

  const rows = order.items
    .map((i, idx) => ({ item: i, rbr: workOrderItemRbr(idx) }))
    .filter(({ item }) => !item.isPlaceholder && item.extinguisher)
    .map(({ item: i, rbr }) => {
      const ex = i.extinguisher!;
      const typeParts = ex.type ? formatExtinguisherTypeParts(ex.type) : null;
      const typeLabel = typeParts
        ? typeParts.meta
          ? `${typeParts.main} (${typeParts.meta})`
          : typeParts.main
        : "—";

      return {
        rbr,
        internalCode: ex.internalCode,
        manufacturer: displayManufacturer(ex.manufacturer),
        type: typeLabel,
        serial: ex.serialNumber,
        year: String(ex.productionYear),
        note: ex.typeDescription ?? "",
      };
    });

  const dep = order.department;
  const cust = order.customer;

  const generatedAt = now;
  const hh = String(generatedAt.getHours()).padStart(2, "0");
  const mm = String(generatedAt.getMinutes()).padStart(2, "0");
  const generatedAtLabel = `${formatDateDdMmYyyy(generatedAt)} ${hh}:${mm}`;

  const qrPayload = `VATROLOG:PRIMKA:${order.orderNumber}:${order.company.oib}`;
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 180, errorCorrectionLevel: "M" });
  } catch {
    qrDataUrl = null;
  }

  const deliveryModeLabel = describeWorkOrderServiceContext({
    deliveryMode: order.deliveryMode,
    serviceLocationKind: order.serviceLocation?.kind,
  });
  const locationText = order.serviceLocation
    ? `${order.serviceLocation.kind === "STATIONARY" ? "S" : "V"} ${order.serviceLocation.label}`
    : "—";

  const data: PrimkaPdfData = {
    company: {
      name: order.company.name,
      oib: order.company.oib,
      street: order.company.street,
      city: order.company.city,
      postalCode: order.company.postalCode,
      iban: order.company.iban,
      contactName: order.company.contactName ?? null,
      phone: order.company.phone ?? null,
      email: order.company.email ?? null,
    },
    orderNumber: order.orderNumber,
    customer: {
      displayName: customerDisplayName(cust),
      fullName: cust.name,
      oib: cust.oib,
      address: cust.address,
      street: cust.street,
      postalCode: cust.postalCode,
      city: cust.city,
      contactPerson: dep?.contactPerson ?? cust.contactPerson ?? null,
      phone: dep?.phone ?? cust.phone ?? null,
      email: dep?.email ?? cust.email ?? null,
      department: dep?.name ?? null,
    },
    dates: {
      receiptDate: formatDateDdMmYyyy(order.receivedAt),
      dueDate: formatDateDdMmYyyy(order.dueAt) || "—",
      printDate: formatDateDdMmYyyy(generatedAt),
    },
    deliveryModeLabel,
    serviceFooterLine: `Lokacija: ${locationText}  ·  Način servisa: ${deliveryModeLabel}`,
    status: order.status,
    docId,
    generatedAtLabel,
    appVersion: APP_VERSION,
    qrDataUrl,
    rows,
    receiptDeliveryLines: receiptLines.allLines,
    unidentifiedPlaceholderCount,
    note: order.note,
  };

  return {
    data,
    companyId: order.companyId,
    filename: pdfNames.fileName,
    fileBase: pdfNames.fileBase,
  };
}

/** Live generiranje (portal / legacy). Tenant UI koristi izdane primke preko `primkaIssue`. */
export async function buildPrimkaPdf(workOrderId: string): Promise<BuiltPdf | null> {
  const built = await buildPrimkaPdfData(workOrderId);
  if (!built) return null;

  await prisma.documentLog.create({
    data: { companyId: built.companyId, workOrderId, docType: "PRIMKA_PDF" },
  });

  const props = { data: built.data } satisfies ComponentProps<typeof PrimkaPdfDocument>;
  const element = React.createElement(PrimkaPdfDocument, props);
  const body = await renderPdfToBuffer(element);

  savePdf(built.companyId, "receipt", built.data.orderNumber, Buffer.from(body), {
    fileBase: built.fileBase,
  }).catch(() => {});

  return { body: Buffer.from(body), filename: built.filename, companyId: built.companyId };
}

export async function buildRegisterPdf(workOrderId: string): Promise<BuiltPdf | null> {
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      company: true,
      customer: true,
      department: true,
      serviceLocation: { select: { kind: true, label: true } },
      items: {
        orderBy: WORK_ORDER_ITEM_ORDER_BY,
        include: {
          parts: { include: { part: { select: { code: true, name: true, manufacturerCode: true } } } },
          extinguisher: {
            include: { manufacturer: true, type: { include: { agent: true, construction: true } } },
          },
        },
      },
    },
  });

  if (!order) return null;

  const pdfNames = buildWorkOrderPdfNames(
    { serviceCode: order.company.serviceCode, usernameSlug: order.company.usernameSlug },
    { orderNumber: order.orderNumber, customer: order.customer },
    "upisnik",
  );
  const docId = pdfNames.docId;

  const now = new Date();

  // Isti redoslijed i R.br. kao na radnom nalogu (bez sortiranja po lokaciji).
  const rows = order.items
    .map((i, idx) => ({ item: i, rbr: workOrderItemRbr(idx) }))
    .filter(({ item }) => !item.isPlaceholder && item.extinguisher)
    .map(({ item: i, rbr }) => {
      const ex = i.extinguisher!;
      const typeParts = ex.type ? formatExtinguisherTypeParts(ex.type) : null;
      const typeLabel = typeParts
        ? typeParts.meta
          ? `${typeParts.main} (${typeParts.meta})`
          : typeParts.main
        : "-";

      const internalDone = !!i.internalDone;

      const structuredParts = (i.parts ?? [])
        .map((p) => (p.snapshotName ?? p.part?.name ?? "").trim())
        .filter((s) => s.length > 0);
      const uniqueNames = Array.from(new Set(structuredParts));
      const partsLabel = uniqueNames.length > 0 ? uniqueNames.join(", ") : (i.partsText ?? "").trim();

      return {
        rbr,
        manufacturer: displayManufacturer(ex.manufacturer),
        type: typeLabel,
        internalCode: (ex.internalCode ?? "").trim() || "-",
        serial: ex.serialNumber,
        year: ex.productionYear,
        internal: internalDone ? "DA" : "NE",
        internalDone,
        parts: partsLabel,
        nextPeriodic: formatDateDdMmYyyy(i.nextPeriodicDue),
        nextInternal: formatDateDdMmYyyy(i.nextInternalDue),
        location: i.serviceLocationText ?? "-",
        label: i.labelNumber ?? "-",
        servicedAt: formatDateDdMmYyyy(i.servicedAt),
      };
    });

  const dep = order.department;
  const cust = order.customer;

  const generatedAt = now;
  const hh = String(generatedAt.getHours()).padStart(2, "0");
  const mm = String(generatedAt.getMinutes()).padStart(2, "0");
  const generatedAtLabel = `${formatDateDdMmYyyy(generatedAt)} ${hh}:${mm}`;

  const qrPayload = `VATROLOG:UPISNIK:${order.orderNumber}:${order.company.oib}`;
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 180, errorCorrectionLevel: "M" });
  } catch {
    qrDataUrl = null;
  }

  const serviceContextLabel = describeWorkOrderServiceContext({
    deliveryMode: order.deliveryMode,
    serviceLocationKind: order.serviceLocation?.kind,
  });
  const locationText = order.serviceLocation
    ? `${order.serviceLocation.kind === "STATIONARY" ? "S" : "V"} ${order.serviceLocation.label}`
    : "—";

  const data: RegisterPdfData = {
    company: {
      name: order.company.name,
      oib: order.company.oib,
      street: order.company.street,
      city: order.company.city,
      postalCode: order.company.postalCode,
      iban: order.company.iban,
      contactName: order.company.contactName ?? null,
      phone: order.company.phone ?? null,
      email: order.company.email ?? null,
    },
    orderNumber: order.orderNumber,
    customer: {
      displayName: customerDisplayName(cust),
      fullName: cust.name,
      oib: cust.oib,
      address: cust.address,
      street: cust.street,
      postalCode: cust.postalCode,
      city: cust.city,
      contactPerson: dep?.contactPerson ?? cust.contactPerson ?? null,
      phone: dep?.phone ?? cust.phone ?? null,
      email: dep?.email ?? cust.email ?? null,
      department: dep?.name ?? null,
    },
    dates: {
      receiptDate: formatDateDdMmYyyy(order.receivedAt ?? null),
      orderDate: formatDateDdMmYyyy(order.receivedAt ?? order.createdAt),
      registerDate: formatDateDdMmYyyy(generatedAt),
    },
    orderNote: order.note?.trim() || null,
    serviceContextLabel,
    serviceFooterLine: `Lokacija: ${locationText}  ·  Način servisa: ${serviceContextLabel}`,
    status: order.status,
    docId,
    generatedAtLabel,
    appVersion: APP_VERSION,
    qrDataUrl,
    rows,
  };

  await prisma.documentLog.create({
    data: { companyId: order.companyId, workOrderId: order.id, docType: "REGISTER_PDF" },
  });

  const props = { data } satisfies ComponentProps<typeof RegisterPdfDocument>;
  const element = React.createElement(RegisterPdfDocument, props);
  const body = await renderPdfToBuffer(element);

  savePdf(order.companyId, "register", order.orderNumber, Buffer.from(body), {
    fileBase: pdfNames.fileBase,
  }).catch(() => {});

  return { body: Buffer.from(body), filename: pdfNames.fileName, companyId: order.companyId };
}
