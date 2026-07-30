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
import { ensureDefaultTemplates, renderTemplateHtml, renderSubject, type RenderVars } from "@/lib/emailTemplates";
import { buildRegisterPdf } from "@/lib/pdf/workOrderDocumentBuilders";
import { WORK_ORDER_ITEM_ORDER_BY } from "@/lib/workOrderItemOrder";

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
      items: {
        orderBy: WORK_ORDER_ITEM_ORDER_BY,
        select: { isPlaceholder: true, extinguisherId: true },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Nalog ne postoji" }, { status: 404 });
  }

  if (order.status !== "LOCKED") {
    return NextResponse.json({ error: "Nalog mora biti zaključan" }, { status: 400 });
  }

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
  const itemCount = order.items.filter((i) => !i.isPlaceholder && i.extinguisherId).length;

  const vars: RenderVars = {
    mjesec: "",
    broj: itemCount,
    kupac: custName,
    tvrtka: company.name,
    nalog: order.orderNumber,
  };

  const subject = renderSubject(registerTpl, vars);
  const html = renderTemplateHtml(registerTpl, vars);

  const built = await buildRegisterPdf(workOrderId);
  if (!built) {
    return NextResponse.json({ error: "Nalog ne postoji" }, { status: 404 });
  }

  const pdfBuffer = built.body;
  const pdfFilename = built.filename;
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
