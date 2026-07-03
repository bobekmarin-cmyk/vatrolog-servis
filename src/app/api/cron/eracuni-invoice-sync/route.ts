import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardCronRequest } from "@/lib/cronAuth";
import { refreshEracuniInvoiceForWorkOrder } from "@/lib/eracuniInvoiceActions";
import { logInfo } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Automatska sinkronizacija e-računi računa (2x dnevno, vidi vercel.json).
 * Za sve koncepte (DRAFT) provjeri je li račun u međuvremenu izdan u
 * e-računima; ako jest, povuče broj i PDF te ga učini vidljivim kupcu
 * u korisničkom portalu — bez ručnog klika na „Provjeri račun”.
 */
export async function GET(req: Request): Promise<Response> {
  const denied = guardCronRequest(req);
  if (denied) return denied;

  const drafts = await prisma.workOrderInvoice.findMany({
    where: {
      status: "DRAFT",
      eracuniDocumentId: { not: null },
      company: { plan: "PREMIUM" },
    },
    select: { workOrderId: true, companyId: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  let issued = 0;
  let stillDraft = 0;
  let errors = 0;

  for (const d of drafts) {
    try {
      const result = await refreshEracuniInvoiceForWorkOrder({
        companyId: d.companyId,
        workOrderId: d.workOrderId,
        accountUserId: null,
      });
      if (result.ok && result.kind === "issued") issued += 1;
      else if (result.ok && result.kind === "still_draft") stillDraft += 1;
      else errors += 1;
    } catch {
      errors += 1;
    }
  }

  logInfo("cron_eracuni_invoice_sync_done", {
    checked: drafts.length,
    issued,
    stillDraft,
    errors,
  });
  return NextResponse.json({ ok: true, checked: drafts.length, issued, stillDraft, errors });
}
