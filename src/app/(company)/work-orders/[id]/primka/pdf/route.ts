import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatExtinguisherTypeParts } from "@/lib/formatExtinguisherType";
import { redirect, notFound } from "next/navigation";
import { renderPdfToBuffer } from "@/lib/renderPdfToBuffer";
import PrimkaPdfDocument, { type PrimkaPdfData } from "@/pdf/PrimkaPdfDocument";
import React, { type ComponentProps } from "react";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { savePdf } from "@/lib/pdfStorage";
import QRCode from "qrcode";
import { APP_VERSION } from "@/lib/appVersion";
import { describeWorkOrderServiceContext } from "@/lib/workOrderDeliveryDisplay";
import { buildSubsequentDeliveryLinesByDay } from "@/lib/primkaDeliveryLines";
import { buildWorkOrderPdfNames } from "@/lib/workOrderDocumentNames";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      company: true,
      customer: true,
      department: true,
      serviceLocation: { select: { kind: true, label: true } },
      items: {
        orderBy: [{ isPlaceholder: "asc" }, { createdAt: "asc" }],
        include: {
          extinguisher: {
            include: { manufacturer: true, type: { include: { agent: true, construction: true } } },
          },
        },
      },
    },
  });

  if (!order) notFound();

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
  const docId = pdfNames.docId;

  const now = new Date();

  const subsequentDeliveryLines = buildSubsequentDeliveryLinesByDay(
    order.items.map((i) => ({
      isPlaceholder: i.isPlaceholder,
      fromInitialReceipt: i.fromInitialReceipt,
      createdAt: i.createdAt,
    })),
  );
  const unidentifiedPlaceholderCount = order.items.filter((i) => i.isPlaceholder).length;

  const rows = order.items
    .filter((i) => !i.isPlaceholder && i.extinguisher)
    .map((i, idx) => {
      const ex = i.extinguisher!;
      const typeParts = ex.type ? formatExtinguisherTypeParts(ex.type) : null;
      const typeLabel = typeParts
        ? typeParts.meta
          ? `${typeParts.main} (${typeParts.meta})`
          : typeParts.main
        : "—";

      return {
        rbr: idx + 1,
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
    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 1,
      width: 180,
      errorCorrectionLevel: "M",
    });
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
    initialReceivedQty: order.receivedQty,
    subsequentDeliveryLines,
    unidentifiedPlaceholderCount,
    note: order.note,
  };

  await prisma.documentLog.create({
    data: { companyId: session.companyId, workOrderId: order.id, docType: "PRIMKA_PDF" },
  });

  const props = { data } satisfies ComponentProps<typeof PrimkaPdfDocument>;
  const element = React.createElement(PrimkaPdfDocument, props);
  const body = await renderPdfToBuffer(element);
  const filename = pdfNames.fileName;

  savePdf(session.companyId, "receipt", order.orderNumber, Buffer.from(body), {
    fileBase: pdfNames.fileBase,
  }).catch(() => {});

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
