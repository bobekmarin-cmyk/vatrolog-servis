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
  type TemplateType,
} from "@/lib/emailTemplates";
import { buildWorkOrderPdfNames, type WorkOrderDocSlug } from "@/lib/workOrderDocumentNames";
import { getActiveDeliveryNote } from "@/lib/deliveryNoteIssue";
import { readPdf } from "@/lib/pdfStorage";
import { countWorkOrderItemsForEmailDoc } from "@/lib/workOrderEmailCounts";

export const runtime = "nodejs";

type KindKey = "primka" | "register" | "delivery-note";

const KIND_META: Record<
  KindKey,
  { label: string; filename: string; slug: string; templateType: TemplateType }
> = {
  primka: { label: "Primka", filename: "primka", slug: "primka", templateType: "RECEIPT" },
  register: { label: "Upisnik", filename: "upisnik", slug: "register", templateType: "REGISTER" },
  "delivery-note": {
    label: "Otpremnica",
    filename: "otpremnica",
    slug: "delivery-note",
    templateType: "DELIVERY_NOTE",
  },
};

function isKind(x: unknown): x is KindKey {
  return typeof x === "string" && x in KIND_META;
}

function kindToDocSlug(kind: KindKey): WorkOrderDocSlug {
  if (kind === "primka") return "primka";
  if (kind === "register") return "upisnik";
  return "otpremnica";
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
    include: {
      company: true,
      customer: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Nalog ne postoji" }, { status: 404 });
  }

  if (kind === "delivery-note" && order.status !== "LOCKED") {
    return NextResponse.json(
      { error: "Otpremnicu je moguće poslati tek nakon zaključavanja radnog naloga." },
      { status: 400 },
    );
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

  const pdfNames = buildWorkOrderPdfNames(
    {
      serviceCode: company.serviceCode,
      usernameSlug: company.usernameSlug,
    },
    {
      orderNumber: order.orderNumber,
      customer: order.customer,
    },
    kindToDocSlug(kind),
  );

  let pdfBuffer: Buffer;
  let pdfFilename = pdfNames.fileName;

  if (kind === "delivery-note") {
    const activeDn = await getActiveDeliveryNote(prisma, session.companyId, workOrderId);
    if (!activeDn?.pdfStoragePath) {
      return NextResponse.json(
        {
          error:
            "Prvo izdajte otpremnicu na stranici radnog naloga (gumb „Izdaj otpremnicu“), zatim ponovno pošaljite mail.",
        },
        { status: 400 },
      );
    }
    try {
      pdfBuffer = await readPdf(activeDn.pdfStoragePath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nepoznata greška";
      return NextResponse.json({ error: `Čitanje arhivske otpremnice nije uspjelo: ${msg}` }, { status: 500 });
    }
    const safeNum = activeDn.number.replace(/[^a-zA-Z0-9-]+/g, "_");
    pdfFilename = `otpremnica_${safeNum}.pdf`;
  } else {
    // Interni fetch PDF-a (reuse postojećih GET ruta s istom sesijom).
    const cookieHdr = req.headers.get("cookie") ?? "";
    const port = process.env.PORT?.trim() || "3000";
    const internalBase = `http://127.0.0.1:${port}`;
    const path = `/work-orders/${workOrderId}/${meta.slug}/pdf`;
    try {
      const pdfRes = await fetch(internalBase + path, {
        headers: { cookie: cookieHdr },
        cache: "no-store",
      });
      if (!pdfRes.ok) {
        const detail = await pdfRes.text().catch(() => "");
        return NextResponse.json(
          { error: `Generiranje PDF-a nije uspjelo (${pdfRes.status})${detail ? `: ${detail.slice(0, 200)}` : ""}` },
          { status: 500 },
        );
      }
      pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nepoznata greška";
      return NextResponse.json({ error: `PDF fetch (${internalBase}${path}): ${msg}` }, { status: 500 });
    }
  }

  const custName = customerDisplayName(order.customer);

  // Sva tri tipa (RECEIPT/REGISTER/DELIVERY_NOTE) idu kroz konfigurabilan
  // predložak iz EmailTemplate tablice — admin može mijenjati tekst u
  // Postavke → E-mail predlošci.
  const templates = await ensureDefaultTemplates(session.companyId);
  const tpl = templates.find((t) => t.type === meta.templateType);
  if (!tpl) {
    return NextResponse.json(
      { error: `Predložak za "${meta.label}" nije pronađen` },
      { status: 500 },
    );
  }

  const broj = await countWorkOrderItemsForEmailDoc(session.companyId, order.id, kind);

  const vars: RenderVars = {
    mjesec: "",
    broj,
    kupac: custName,
    tvrtka: company.name,
    nalog: order.orderNumber,
  };
  const subject = renderSubject(tpl, vars);
  const html = renderTemplateHtml(tpl, vars);

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
        itemCount: broj,
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
      itemCount: broj,
      status: "SENT",
    },
  });

  return NextResponse.json({ ok: true });
}
