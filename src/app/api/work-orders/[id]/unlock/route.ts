import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { unlockWorkOrderCore, hasBlockingInvoice } from "@/lib/workOrderUnlock";

import { redirectRelative } from "@/lib/httpRedirect";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  }
  if (order.companyId !== session.companyId) {
    return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  }

  if (order.status !== "LOCKED") {
    return redirectRelative(`/work-orders/${id}`, 307);
  }

  // Nakon kreiranja računa (koncept ili izdan) nalog je fiskalno vezan —
  // otključati ga može samo vendor (platforma) u iznimnim slučajevima.
  if (await hasBlockingInvoice(id)) {
    return redirectRelative(`/work-orders/${id}?inv=unlock_blocked`, 303);
  }

  const { labelResult, stockResult } = await unlockWorkOrderCore(session.companyId, id);

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "workOrder.unlock",
    entity: "WorkOrder",
    entityId: id,
    meta: { labelsReverted: labelResult.reverted, stockRestored: stockResult.restored },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return redirectRelative(`/work-orders/${id}`, 307);
}
