import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (order.companyId !== session.companyId) {
    return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  }
  if (order.status === "LOCKED") {
    return NextResponse.json({ error: "Nalog je zaključan." }, { status: 409 });
  }

  const item = await prisma.workOrderItem.findUnique({
    where: { id: itemId },
    include: { extinguisher: true },
  });
  if (!item) return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
  if (item.workOrderId !== id) {
    return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
  }
  if (item.companyId !== session.companyId) {
    return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  }

  const extinguisherId = item.extinguisherId;

  await prisma.$transaction(async (tx) => {
    await tx.workOrderItemPart.deleteMany({ where: { workOrderItemId: itemId } });
    await tx.workOrderItemCustomService.deleteMany({ where: { workOrderItemId: itemId } });

    await tx.workOrderItem.update({
      where: { id: itemId },
      data: {
        periodicDone: false,
        internalDone: false,
        internalDoneAt: null,
        servicerId: null,
        labelNumber: null,
        partsText: null,
        serviceLocationText: null,
        serviceNote: null,
        servicedAt: null,
        nextPeriodicDue: null,
        nextInternalDue: null,
      },
    });

    if (extinguisherId) {
      await tx.extinguisher.update({
        where: { id: extinguisherId },
        data: {
          lastPeriodicAt: null,
          lastInternalAt: null,
          nextPeriodicDue: null,
          nextInternalDue: null,
        },
      });
    }
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "workOrderItem.reset",
    entity: "WorkOrderItem",
    entityId: itemId,
    meta: {
      workOrderId: id,
      extinguisherId: extinguisherId ?? null,
      previousLabelNumber: item.labelNumber ?? null,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true });
}
