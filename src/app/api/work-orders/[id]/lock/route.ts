import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { decrementStockForWorkOrder } from "@/lib/partStock";
import { consumeLabelsOnLock } from "@/lib/serviceLabels";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

import { redirectRelative } from "@/lib/httpRedirect";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const order = await prisma.workOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (order.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });

  // Ako već zaključan — idempotentno
  if (order.status === "LOCKED") {
    return redirectRelative(`/work-orders/${id}`, 307);
  }

  // Po želji: upozorenje o mismatch primka≠nalog (dozvoljavamo zaključavanje)
  // Ako želiš hard-block, ovdje vrati 409 umjesto update-a.

  const now = new Date();

  const { stockResult, labelResult, removedPlaceholders, newReceivedQty } = await prisma.$transaction(async (tx) => {
    const placeholderDelete = await tx.workOrderItem.deleteMany({
      where: {
        workOrderId: id,
        companyId: session.companyId,
        isPlaceholder: true,
        extinguisherId: null,
      },
    });
    const remainingCount = await tx.workOrderItem.count({
      where: { workOrderId: id, companyId: session.companyId },
    });
    const nextReceivedQty = Math.min(order.receivedQty, remainingCount);

    await tx.workOrder.update({
      where: { id },
      data: {
        status: "LOCKED",
        lockedAt: now,
        finishedAt: now,
        receivedQty: nextReceivedQty,
      },
    });
    const res = await decrementStockForWorkOrder(
      tx as unknown as Parameters<typeof decrementStockForWorkOrder>[0],
      {
        companyId: session.companyId,
        workOrderId: id,
      },
    );
    const labels = await consumeLabelsOnLock(
      tx as unknown as Parameters<typeof consumeLabelsOnLock>[0],
      {
        companyId: session.companyId,
        workOrderId: id,
      },
    );
    return {
      stockResult: res,
      labelResult: labels,
      removedPlaceholders: placeholderDelete.count,
      newReceivedQty: nextReceivedQty,
    };
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "workOrder.lock",
    entity: "WorkOrder",
    entityId: id,
    meta: {
      decremented: stockResult.decremented,
      lowStockCount: stockResult.lowStock.length,
      labelsConsumed: labelResult.consumed,
      labelRows: labelResult.rows.length,
      removedPlaceholders,
      newReceivedQty,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return redirectRelative(`/work-orders/${id}`, 307);
}
