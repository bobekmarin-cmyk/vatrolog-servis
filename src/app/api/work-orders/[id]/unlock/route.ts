import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { restoreStockForWorkOrder } from "@/lib/partStock";
import { revertLabelConsumptionOnUnlock } from "@/lib/serviceLabels";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

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

  const { labelResult, stockResult } = await prisma.$transaction(async (tx) => {
    await tx.workOrder.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        lockedAt: null,
        lockedById: null,
        finishedAt: null,
      },
    });
    const labels = await revertLabelConsumptionOnUnlock(
      tx as unknown as Parameters<typeof revertLabelConsumptionOnUnlock>[0],
      {
        companyId: session.companyId,
        workOrderId: id,
      },
    );
    const stock = await restoreStockForWorkOrder(
      tx as unknown as Parameters<typeof restoreStockForWorkOrder>[0],
      {
        companyId: session.companyId,
        workOrderId: id,
      },
    );
    return { labelResult: labels, stockResult: stock };
  });

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
