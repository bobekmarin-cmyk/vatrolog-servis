import { prisma } from "@/lib/prisma";
import {
  createDraftInvoice,
  ensurePartner,
  getERacuniSettings,
  getInvoicePdf,
  getInvoiceStatus,
  ERacuniError,
} from "@/lib/eracuni";
import { buildEracuniInvoice } from "@/lib/eracuniInvoice";
import { savePdf } from "@/lib/pdfStorage";
import { logAudit } from "@/lib/auditLog";
import { companyPlanAllows } from "@/lib/subscriptionPlan";

/**
 * Orkestracija kreiranja i osvježavanja e-računi računa za radni nalog.
 * Rezultati se mapiraju na flash poruke na stranici naloga; detaljne greške
 * (npr. popis stavki bez cijene) spremaju se u WorkOrderInvoice.errorMessage.
 */

export type InvoiceActionResult =
  | { ok: true; kind: "created"; number: string | null }
  | { ok: true; kind: "issued"; number: string | null }
  | { ok: true; kind: "still_draft" }
  | {
      ok: false;
      kind: "not_configured" | "plan_required" | "already_exists" | "no_invoice" | "problems" | "api_error";
    };

export async function createEracuniInvoiceForWorkOrder(options: {
  companyId: string;
  workOrderId: string;
  accountUserId: string | null;
}): Promise<InvoiceActionResult> {
  const { companyId, workOrderId, accountUserId } = options;

  if (!(await companyPlanAllows(companyId, "INVOICING_INTEGRATIONS"))) {
    return { ok: false, kind: "plan_required" };
  }

  const settings = await getERacuniSettings(companyId);
  if (!settings?.enabled || !settings.credentials) {
    return { ok: false, kind: "not_configured" };
  }

  const existing = await prisma.workOrderInvoice.findUnique({ where: { workOrderId } });
  if (existing && existing.status !== "ERROR") {
    return { ok: false, kind: "already_exists" };
  }

  const build = await buildEracuniInvoice(companyId, workOrderId, settings);
  if (!build.ok) {
    await prisma.workOrderInvoice.upsert({
      where: { workOrderId },
      create: {
        companyId,
        workOrderId,
        status: "ERROR",
        errorMessage: build.problems.join("\n"),
        createdByAccountUserId: accountUserId,
      },
      update: { status: "ERROR", errorMessage: build.problems.join("\n") },
    });
    return { ok: false, kind: "problems" };
  }

  // Red se kreira prije API poziva: njegov ID služi kao apiTransactionId
  // (idempotencija — ponovni pokušaj s istim ID-em ne kreira drugi dokument).
  const row = await prisma.workOrderInvoice.upsert({
    where: { workOrderId },
    create: {
      companyId,
      workOrderId,
      status: "ERROR",
      errorMessage: null,
      createdByAccountUserId: accountUserId,
    },
    update: { errorMessage: null, createdByAccountUserId: accountUserId },
  });

  try {
    const partner = await ensurePartner(settings.credentials, {
      oib: build.buyer.oib,
      name: build.buyer.name,
      street: build.buyer.street,
      postalCode: build.buyer.postalCode,
      city: build.buyer.city,
      email: build.buyer.email,
      phone: build.buyer.phone,
    });

    const created = await createDraftInvoice(settings.credentials, {
      buyer: {
        partnerCode: partner.code,
        name: build.buyer.name,
        oib: build.buyer.oib,
        street: build.buyer.street,
        postalCode: build.buyer.postalCode,
        city: build.buyer.city,
        email: build.buyer.email,
      },
      dateOfSupply: build.dateOfSupply,
      paymentMethod: settings.paymentMethod,
      paymentDueDays: settings.paymentDueDays,
      lines: build.lines,
      remark: build.remark,
      apiTransactionId: `vatrolog-${row.id}`,
    });

    await prisma.workOrderInvoice.update({
      where: { id: row.id },
      data: {
        status: "DRAFT",
        eracuniDocumentId: created.documentId,
        number: created.number,
        errorMessage: build.warnings.length > 0 ? `Upozorenja:\n${build.warnings.join("\n")}` : null,
      },
    });

    await logAudit({
      companyId,
      actorId: accountUserId,
      actorType: "ACCOUNT_USER",
      action: "eracuni.invoice.create",
      entity: "WorkOrderInvoice",
      entityId: row.id,
      meta: { workOrderId, documentId: created.documentId, number: created.number, lines: build.lines.length },
    });

    return { ok: true, kind: "created", number: created.number };
  } catch (e) {
    const msg = e instanceof ERacuniError ? e.message : "Neočekivana greška pri komunikaciji s e-računima.";
    await prisma.workOrderInvoice.update({
      where: { id: row.id },
      data: { status: "ERROR", errorMessage: msg },
    });
    return { ok: false, kind: "api_error" };
  }
}

export async function refreshEracuniInvoiceForWorkOrder(options: {
  companyId: string;
  workOrderId: string;
  accountUserId: string | null;
}): Promise<InvoiceActionResult> {
  const { companyId, workOrderId, accountUserId } = options;

  if (!(await companyPlanAllows(companyId, "INVOICING_INTEGRATIONS"))) {
    return { ok: false, kind: "plan_required" };
  }

  const settings = await getERacuniSettings(companyId);
  if (!settings?.enabled || !settings.credentials) {
    return { ok: false, kind: "not_configured" };
  }

  const row = await prisma.workOrderInvoice.findUnique({ where: { workOrderId } });
  if (!row || row.companyId !== companyId || !row.eracuniDocumentId) {
    return { ok: false, kind: "no_invoice" };
  }
  if (row.status === "ISSUED" && row.pdfStoragePath) {
    return { ok: true, kind: "issued", number: row.number };
  }

  try {
    const status = await getInvoiceStatus(settings.credentials, row.eracuniDocumentId);
    if (!status.issued) {
      return { ok: true, kind: "still_draft" };
    }

    const pdf = await getInvoicePdf(settings.credentials, row.eracuniDocumentId);
    const order = await prisma.workOrder.findUniqueOrThrow({
      where: { id: workOrderId },
      select: { orderNumber: true },
    });
    const safeNumber = (status.number ?? row.number ?? row.id).replace(/[^a-zA-Z0-9]+/g, "_");
    const pdfStoragePath = await savePdf(companyId, "invoice", order.orderNumber, pdf, {
      fileBase: `racun_${safeNumber}_${workOrderId}`,
    });

    await prisma.workOrderInvoice.update({
      where: { id: row.id },
      data: {
        status: "ISSUED",
        number: status.number ?? row.number,
        pdfStoragePath,
        issuedAt: new Date(),
      },
    });

    await logAudit({
      companyId,
      actorId: accountUserId,
      actorType: "ACCOUNT_USER",
      action: "eracuni.invoice.issued",
      entity: "WorkOrderInvoice",
      entityId: row.id,
      meta: { workOrderId, number: status.number ?? row.number },
    });

    return { ok: true, kind: "issued", number: status.number ?? row.number };
  } catch {
    return { ok: false, kind: "api_error" };
  }
}
