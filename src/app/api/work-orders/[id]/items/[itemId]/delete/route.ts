import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import { redirectRelative } from "@/lib/httpRedirect";
import { receiptFloorBlocksDelete, receiptFloorMessage } from "@/lib/workOrderReceiptFloor";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Samo admin može brisati stavke." }, { status: 403 });

  const order = await prisma.workOrder.findUnique({
    where: { id },
    select: { id: true, status: true, companyId: true, receivedQty: true },
  });

  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (order.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  if (order.status === "LOCKED") {
    return NextResponse.json({ error: "Nalog je zaključan." }, { status: 409 });
  }

  const [item, itemCount] = await Promise.all([
    prisma.workOrderItem.findUnique({
      where: { id: itemId },
      select: { id: true, workOrderId: true, extinguisherId: true },
    }),
    prisma.workOrderItem.count({ where: { workOrderId: id } }),
  ]);

  if (!item || item.workOrderId !== id) {
    return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
  }

  if (receiptFloorBlocksDelete({ itemCount, receivedQty: order.receivedQty })) {
    return NextResponse.json(
      { error: receiptFloorMessage(order.receivedQty), reason: "receipt_floor" },
      { status: 409 },
    );
  }

  await prisma.workOrderItem.delete({ where: { id: itemId } });

  return redirectRelative(`/work-orders/${id}`, 307);
}
