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
import {
  ensureDefaultTemplates,
  renderSubject,
  renderTemplateHtml,
  type RenderVars,
} from "@/lib/emailTemplates";

export const runtime = "nodejs";

type KindKey = "primka" | "register" | "delivery-note";

const KIND_META: Record<KindKey, { label: string; filename: string; slug: string }> = {
  primka: { label: "Primka", filename: "primka", slug: "primka" },
  register: { label: "Upisnik", filename: "upisnik", slug: "register" },
  "delivery-note": { label: "Otpremnica", filename: "otpremnica", slug: "delivery-note" },
};

function isKind(x: unknown): x is KindKey {
  return typeof x === "string" && x in KIND_META;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as {
    workOrderId?: string;
    kind?: string;
    toEmail?: string;
  };
  const { workOrderId, toEmail } = payload;

  if (!workOrderId || !isKind(payload.kind)) {
    return NextResponse.json({ error: "Neispravni parametri" }, { status: 400 });
  }
  const kind: KindKey = payload.kind;
  const meta = KIND_META[kind];

  const order = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId: session.companyId },
    include: { company: true, customer: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Nalog ne postoji" }, { status: 404 });
  }

  const recipientEmail = (toEmail ?? order.customer.email ?? "").trim();
  if (!recipientEmail) {
    return NextResponse.json({ error: "Adresat nije zadan" }, { status: 400 });
  }

  const company = order.company;

  const mailStatus = await getTenantMailStatus(session.companyId);
  if (!mailStatus.activeProvider) {
    return NextResponse.json(
      { error: "Mail nije konfiguriran. Povežite Gmail ili SMTP u Postavke → Postavke maila." },
      { status: 400 },
    );
  }

  // Interni fetch PDF-a (reuse postojećih GET ruta s istom sesijom).
  const cookieHdr = req.headers.get("cookie") ?? "";
  const pdfUrl = new URL(`/work-orders/${workOrderId}/${meta.slug}/pdf`, req.url);
  let pdfBuffer: Buffer;
  try {
    const pdfRes = await fetch(pdfUrl, {
      headers: { cookie: cookieHdr },
      cache: "no-store",
    });
    if (!pdfRes.ok) {
      return NextResponse.json(
        { error: `Generiranje PDF-a nije uspjelo (${pdfRes.status})` },
        { status: 500 },
      );
    }
    pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nepoznata greška";
    return NextResponse.json({ error: `PDF fetch: ${msg}` }, { status: 500 });
  }

  const custName = customerDisplayName(order.customer);

  let subject: string;
  let html: string;
  if (kind === "register") {
    const templates = await ensureDefaultTemplates(session.companyId);
    const tpl = templates.find((t) => t.type === "REGISTER");
    if (!tpl) {
      return NextResponse.json({ error: "Predložak za upisnik nije pronađen" }, { status: 500 });
    }
    const servicedCount = await prisma.workOrderItem.count({
      where: {
        workOrderId: order.id,
        companyId: session.companyId,
        isPlaceholder: false,
        periodicDone: true,
        extinguisherId: { not: null },
      },
    });
    const vars: RenderVars = {
      mjesec: "",
      broj: servicedCount,
      kupac: custName,
      tvrtka: company.name,
      nalog: order.orderNumber,
    };
    subject = renderSubject(tpl, vars);
    html = renderTemplateHtml(tpl, vars);
  } else {
    subject = `${meta.label} – nalog ${order.orderNumber}`;
    html = `
      <p>Poštovani,</p>
      <p>u prilogu Vam šaljemo dokument <strong>${meta.label}</strong> za radni nalog <strong>${order.orderNumber}</strong>.</p>
      <p>Srdačan pozdrav,<br/>${company.name}</p>
    `;
  }

  const pdfFilename = `${meta.filename}_${order.orderNumber.replaceAll("/", "-")}.pdf`;
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
        itemCount: 0,
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
      itemCount: 0,
      status: "SENT",
    },
  });

  return NextResponse.json({ ok: true });
}
