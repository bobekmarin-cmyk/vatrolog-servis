import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getTenantMailStatus,
  sendTenantMail,
  TenantMailNotConfiguredError,
  TenantMailSendError,
} from "@/lib/tenantMail";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { ensureDefaultTemplates, renderTemplateHtml, renderSubject, type RenderVars } from "@/lib/emailTemplates";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { renderPdfToBuffer } from "@/lib/renderPdfToBuffer";
import RegisterPdfDocument, { type RegisterPdfData } from "@/pdf/RegisterPdfDocument";
import React, { type ComponentProps } from "react";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { savePdf } from "@/lib/pdfStorage";
import { APP_VERSION } from "@/lib/appVersion";
import { describeWorkOrderServiceContext } from "@/lib/workOrderDeliveryDisplay";
import { buildWorkOrderPdfNames } from "@/lib/workOrderDocumentNames";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json();
  const { workOrderId, toEmail: toEmailOverride } = payload as { workOrderId: string; toEmail?: string };

  if (!workOrderId) {
    return NextResponse.json({ error: "Missing workOrderId" }, { status: 400 });
  }

  const order = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId: session.companyId },
    include: {
      company: true,
      customer: true,
      serviceLocation: { select: { kind: true } },
      items: {
        orderBy: [{ isPlaceholder: "asc" }, { createdAt: "asc" }],
        include: {
          servicer: true,
          extinguisher: {
            include: { manufacturer: true, type: { include: { agent: true, construction: true } } },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Nalog ne postoji" }, { status: 404 });
  }

  if (order.status !== "LOCKED") {
    return NextResponse.json({ error: "Nalog mora biti zaključan" }, { status: 400 });
  }

  const pdfNames = buildWorkOrderPdfNames(
    {
      serviceCode: order.company.serviceCode,
      usernameSlug: order.company.usernameSlug,
    },
    {
      orderNumber: order.orderNumber,
      customer: order.customer,
    },
    "upisnik",
  );

  const recipientEmail = (toEmailOverride ?? order.customer.email ?? "").trim();
  if (!recipientEmail) {
    return NextResponse.json({ error: "Kupac nema email adresu" }, { status: 400 });
  }

  const company = order.company;

  const mailStatus = await getTenantMailStatus(session.companyId);
  if (!mailStatus.activeProvider) {
    return NextResponse.json(
      { error: "Mail nije konfiguriran. Povežite Gmail ili SMTP u Postavke → Postavke maila." },
      { status: 400 },
    );
  }

  // --- Load REGISTER template ---
  const templates = await ensureDefaultTemplates(session.companyId);
  const registerTpl = templates.find((t) => t.type === "REGISTER");
  if (!registerTpl) {
    return NextResponse.json({ error: "Predložak za upisnik nije pronađen" }, { status: 500 });
  }

  const custName = customerDisplayName(order.customer);
  // Usklađeno s PDF upisnikom: identificirani aparati (ne zahtijeva servicedAt).
  const itemCount = order.items.filter((i) => !i.isPlaceholder && i.extinguisher).length;

  const vars: RenderVars = {
    mjesec: "",
    broj: itemCount,
    kupac: custName,
    tvrtka: company.name,
    nalog: order.orderNumber,
  };

  const subject = renderSubject(registerTpl, vars);
  const html = renderTemplateHtml(registerTpl, vars);

  // --- Generate PDF ---
  const realItems = order.items.filter((i) => !i.isPlaceholder && i.extinguisher);
  const rows = realItems.map((i, idx) => {
    const ex = i.extinguisher!;
    return {
      rbr: idx + 1,
      manufacturer: displayManufacturer(ex.manufacturer),
      type: ex.type ? formatExtinguisherTypeName(ex.type) : "-",
      serial: ex.serialNumber,
      year: ex.productionYear,
      internal: i.internalDone ? "DA" : "NE",
      internalDone: !!i.internalDone,
      parts: i.partsText ?? "",
      nextPeriodic: formatDateDdMmYyyy(i.nextPeriodicDue),
      nextInternal: formatDateDdMmYyyy(i.nextInternalDue),
      location: i.serviceLocationText ?? "-",
      label: i.labelNumber ?? "-",
      servicedAt: formatDateDdMmYyyy(i.servicedAt),
    };
  });

  const generatedAt = new Date();
  const hh = String(generatedAt.getHours()).padStart(2, "0");
  const mm = String(generatedAt.getMinutes()).padStart(2, "0");
  const generatedAtLabel = `${formatDateDdMmYyyy(generatedAt)} ${hh}:${mm}`;

  const serviceContextLabel = describeWorkOrderServiceContext({
    deliveryMode: order.deliveryMode,
    serviceLocationKind: order.serviceLocation?.kind,
  });

  const pdfData: RegisterPdfData = {
    company: {
      name: company.name,
      oib: company.oib,
      street: company.street,
      city: company.city,
      postalCode: company.postalCode,
      iban: company.iban,
    },
    orderNumber: order.orderNumber,
    customer: {
      displayName: custName,
      fullName: order.customer.name,
      oib: order.customer.oib,
      address: order.customer.address,
      street: order.customer.street,
      postalCode: order.customer.postalCode,
      city: order.customer.city,
      contactPerson: order.customer.contactPerson ?? null,
      phone: order.customer.phone ?? null,
      email: order.customer.email ?? null,
      department: null,
    },
    dates: {
      receiptDate: formatDateDdMmYyyy(order.receivedAt ?? null),
      orderDate: formatDateDdMmYyyy(order.receivedAt ?? order.createdAt),
      registerDate: formatDateDdMmYyyy(generatedAt),
    },
    orderNote: order.note?.trim() || null,
    serviceContextLabel,
    status: order.status,
    docId: pdfNames.docId,
    generatedAtLabel,
    appVersion: APP_VERSION,
    qrDataUrl: null,
    rows,
  };

  const pdfProps = { data: pdfData } satisfies ComponentProps<typeof RegisterPdfDocument>;
  const pdfElement = React.createElement(RegisterPdfDocument, pdfProps);
  const pdfBuffer = Buffer.from(await renderPdfToBuffer(pdfElement));

  savePdf(session.companyId, "register", order.orderNumber, pdfBuffer, {
    fileBase: pdfNames.fileBase,
  }).catch(() => {});

  const pdfFilename = pdfNames.fileName;
  const monthTag = `WO-${order.orderNumber}`;

  try {
    await sendTenantMail({
      companyId: session.companyId,
      to: recipientEmail,
      subject,
      html,
      attachment: { filename: pdfFilename, mimeType: "application/pdf", data: pdfBuffer },
    });
  } catch (err) {
    const errMsg =
      err instanceof TenantMailSendError || err instanceof TenantMailNotConfiguredError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);

    await prisma.emailLog.create({
      data: {
        companyId: session.companyId,
        customerId: order.customer.id,
        toEmail: recipientEmail,
        subject,
        htmlBody: html,
        month: monthTag,
        itemCount,
        status: "FAILED",
        error: errMsg.slice(0, 500),
      },
    });
    return NextResponse.json({ error: "Slanje neuspješno: " + errMsg }, { status: 500 });
  }

  await prisma.emailLog.create({
    data: {
      companyId: session.companyId,
      customerId: order.customer.id,
      toEmail: recipientEmail,
      subject,
      htmlBody: html,
      month: monthTag,
      itemCount,
      status: "SENT",
    },
  });

  return NextResponse.json({ ok: true });
}
