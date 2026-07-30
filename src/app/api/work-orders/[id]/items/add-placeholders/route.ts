import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  addQtyToReceiptBatchDay,
  dayKeyFromDate,
  ensureInitialReceiptBatch,
  noonFromDayKey,
} from "@/lib/workOrderReceiptBatches";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  let countRaw: number;
  let receivedAtRaw: string | null = null;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = await req.json();
    countRaw = Number(body.count ?? 1);
    receivedAtRaw = typeof body.receivedAt === "string" ? body.receivedAt : null;
  } else {
    const form = await req.formData();
    countRaw = Number(form.get("count") || 1);
    const ra = form.get("receivedAt");
    receivedAtRaw = typeof ra === "string" ? ra : null;
  }

  const count = Number.isFinite(countRaw) ? Math.floor(countRaw) : 1;
  if (count < 1 || count > 200) {
    return NextResponse.json(
      { error: "Broj aparata mora biti između 1 i 200." },
      { status: 400 }
    );
  }

  const order = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      companyId: true,
      receivedAt: true,
      receivedQty: true,
    },
  });

  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (order.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  if (order.status === "LOCKED") {
    return NextResponse.json({ error: "Nalog je zaključan." }, { status: 409 });
  }

  let receivedAt = new Date();
  if (receivedAtRaw && /^\d{4}-\d{2}-\d{2}$/.test(receivedAtRaw.trim())) {
    receivedAt = noonFromDayKey(receivedAtRaw.trim());
  }

  await ensureInitialReceiptBatch(prisma, {
    companyId: order.companyId,
    workOrderId: order.id,
    receivedAt: order.receivedAt,
    qty: order.receivedQty,
  });

  const data = Array.from({ length: count }).map(() => ({
    companyId: session.companyId,
    workOrderId: id,
    isPlaceholder: true,
    fromInitialReceipt: false,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.workOrderItem.createMany({ data });
    await addQtyToReceiptBatchDay(tx, {
      companyId: session.companyId,
      workOrderId: id,
      receivedAt,
      qty: count,
    });
  });

  return NextResponse.json({
    ok: true,
    added: count,
    receivedAt: dayKeyFromDate(receivedAt),
  });
}
