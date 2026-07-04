import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { redirectRelative } from "@/lib/httpRedirect";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { extractAuditMeta } from "@/lib/auditLog";
import { unlockWorkOrderStatusOnly } from "@/lib/workOrderUnlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vendor (platforma) prisilno otključava zaključani nalog — namijenjeno
 * iznimnim slučajevima, npr. kad je za nalog već kreiran/izdan račun pa
 * tenant više ne može otključati sam. Form body: orderNumber.
 *
 * Samo otključava (status → IN_PROGRESS), NE stornira naljepnice ni skladište;
 * kod ponovnog zaključavanja obračunava se samo razlika.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const rl = await checkRateLimit("platformWrite", clientKeyFromRequest(req), {
    limit: 10,
    windowSec: 60,
  });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše zahtjeva. Pokušaj za ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const { companyId } = await params;
  const form = await req.formData();
  const orderNumber = String(form.get("orderNumber") ?? "").trim();

  const back = (flag: string) =>
    redirectRelative(`/platform/companies/${companyId}?tab=danger&forceUnlock=${flag}`, 303);

  if (!orderNumber) return back("missing");

  const order = await prisma.workOrder.findFirst({
    where: { companyId, orderNumber },
    select: {
      id: true,
      status: true,
      eracuniInvoice: { select: { status: true, number: true } },
    },
  });
  if (!order) return back("not_found");
  if (order.status !== "LOCKED") return back("not_locked");

  await unlockWorkOrderStatusOnly(order.id);

  const meta = extractAuditMeta(req);
  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.workOrder.force_unlock",
      entity: "WorkOrder",
      entityId: order.id,
      meta: {
        orderNumber,
        invoiceStatus: order.eracuniInvoice?.status ?? null,
        invoiceNumber: order.eracuniInvoice?.number ?? null,
        statusOnly: true,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  return back("ok");
}
