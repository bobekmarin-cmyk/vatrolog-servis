import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  dayKeyFromDate,
  ensureInitialReceiptBatch,
  listReceiptBatches,
  replaceReceiptBatches,
} from "@/lib/workOrderReceiptBatches";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { id } = await params;
  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    select: {
      id: true,
      companyId: true,
      status: true,
      receivedAt: true,
      receivedQty: true,
      _count: { select: { items: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });

  await ensureInitialReceiptBatch(prisma, {
    companyId: order.companyId,
    workOrderId: order.id,
    receivedAt: order.receivedAt,
    qty: order.receivedQty,
  });

  const batches = await listReceiptBatches(prisma, order.id);
  return NextResponse.json({
    ok: true,
    itemCount: order._count.items,
    receivedQty: batches.reduce((s, b) => s + b.qty, 0),
    locked: order.status === "LOCKED",
    batches: batches.map((b) => ({
      id: b.id,
      receivedAt: dayKeyFromDate(b.receivedAt),
      receivedAtLabel: formatDateDdMmYyyy(b.receivedAt),
      qty: b.qty,
      isInitial: b.isInitial,
    })),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { id } = await params;
  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    select: {
      id: true,
      companyId: true,
      status: true,
      _count: { select: { items: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (order.status === "LOCKED") {
    return NextResponse.json({ error: "Nalog je zaključan." }, { status: 409 });
  }

  const body = (await req.json()) as {
    batches?: Array<{ id?: string; receivedAt: string; qty: number; isInitial?: boolean }>;
  };
  if (!Array.isArray(body.batches)) {
    return NextResponse.json({ error: "Nedostaju unosi količina." }, { status: 400 });
  }

  try {
    const batches = await replaceReceiptBatches(prisma, {
      companyId: order.companyId,
      workOrderId: order.id,
      batches: body.batches,
      minTotal: order._count.items,
    });
    return NextResponse.json({
      ok: true,
      receivedQty: batches.reduce((s, b) => s + b.qty, 0),
      batches: batches.map((b) => ({
        id: b.id,
        receivedAt: dayKeyFromDate(b.receivedAt),
        receivedAtLabel: formatDateDdMmYyyy(b.receivedAt),
        qty: b.qty,
        isInitial: b.isInitial,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "BELOW_ITEM_COUNT") {
      return NextResponse.json(
        {
          error: `Ukupna količina ne smije biti manja od broja aparata već unesenih u nalog (${order._count.items}).`,
        },
        { status: 409 },
      );
    }
    if (msg === "INITIAL_REQUIRED") {
      return NextResponse.json(
        { error: "Mora postojati točno jedan početni unos (datum otvaranja naloga)." },
        { status: 400 },
      );
    }
    if (msg === "BATCHES_EMPTY") {
      return NextResponse.json({ error: "Unesite barem jednu količinu." }, { status: 400 });
    }
    return NextResponse.json({ error: "Greška pri spremanju." }, { status: 500 });
  }
}
