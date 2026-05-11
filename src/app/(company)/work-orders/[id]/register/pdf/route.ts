import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatExtinguisherTypeParts } from "@/lib/formatExtinguisherType";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { renderPdfToBuffer } from "@/lib/renderPdfToBuffer";
import RegisterPdfDocument, { type RegisterPdfData } from "@/pdf/RegisterPdfDocument";
import React, { type ComponentProps } from "react";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { savePdf } from "@/lib/pdfStorage";
import QRCode from "qrcode";
import { APP_VERSION } from "@/lib/appVersion";
import { describeWorkOrderServiceContext } from "@/lib/workOrderDeliveryDisplay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function agentLabel(a: { label?: string | null; symbol?: string | null } | null | undefined) {
  if (!a) return "-";
  return a.label ?? a.symbol ?? "-";
}

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
          parts: { include: { part: { select: { code: true, name: true, manufacturerCode: true } } } },
          extinguisher: {
            include: { manufacturer: true, type: { include: { agent: true, construction: true } } },
          },
        },
      },
    },
  });

  if (!order) notFound();

  const now = new Date();

  const rowsUnsorted = order.items
    .filter((i) => !i.isPlaceholder && i.extinguisher)
    .map((i) => {
      const ex = i.extinguisher!;
      const typeParts = ex.type ? formatExtinguisherTypeParts(ex.type) : null;
      const typeLabel = typeParts
        ? typeParts.meta
          ? `${typeParts.main} (${typeParts.meta})`
          : typeParts.main
        : "-";

      const internalDone = !!i.internalDone;

      // Upisnik: u stupcu "Dijelovi" prikazujemo isključivo naziv artikla
      // (bez ikakvih šifara — ni tenantovih ni tvorničkih). Snapshot polja
      // imaju prednost zbog povijesne stabilnosti.
      const structuredParts = (i.parts ?? [])
        .map((p) => (p.snapshotName ?? p.part?.name ?? "").trim())
        .filter((s) => s.length > 0);
      const uniqueNames = Array.from(new Set(structuredParts));
      const partsLabel =
        uniqueNames.length > 0
          ? uniqueNames.join(", ")
          : (i.partsText ?? "").trim();

      return {
        rbr: 0,
        manufacturer: displayManufacturer(ex.manufacturer),
        type: typeLabel,
        agent: agentLabel(ex.type?.agent ?? null) || "-",
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

  const collator = new Intl.Collator("hr", { sensitivity: "base" });
  const rows = [...rowsUnsorted]
    .sort((a, b) => collator.compare(a.location, b.location))
    .map((r, idx) => ({ ...r, rbr: idx + 1 }));

  const dep = order.department;
  const cust = order.customer;

  const docId = `upisnik-${order.orderNumber.replaceAll("/", "-")}`;
  const generatedAt = now;
  const hh = String(generatedAt.getHours()).padStart(2, "0");
  const mm = String(generatedAt.getMinutes()).padStart(2, "0");
  const generatedAtLabel = `${formatDateDdMmYyyy(generatedAt)} ${hh}:${mm}`;

  const qrPayload = `VATROLOG:UPISNIK:${order.orderNumber}:${order.company.oib}`;
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
    data: { companyId: session.companyId, workOrderId: order.id, docType: "REGISTER_PDF" },
  });

  const props = { data } satisfies ComponentProps<typeof RegisterPdfDocument>;
  const element = React.createElement(RegisterPdfDocument, props);
  const body = await renderPdfToBuffer(element);
  const filename = `upisnik_${order.orderNumber.replaceAll("/", "-")}.pdf`;

  savePdf(session.companyId, "register", order.orderNumber, Buffer.from(body)).catch(() => {});

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
