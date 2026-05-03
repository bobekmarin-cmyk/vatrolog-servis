import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function parseDateOnly(value: string | null) {
  if (!value) return null;
  const v = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const dot = /^(\d{2})\.(\d{2})\.(\d{4})\.?$/.exec(v);
  if (!iso && !dot) return null;
  const y = Number(iso ? iso[1] : dot![3]);
  const mo = Number(iso ? iso[2] : dot![2]) - 1;
  const dNum = Number(iso ? iso[3] : dot![1]);
  const d = new Date(y, mo, dNum, 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { id } = await params;
  const form = await req.formData();
  const receivedAtStr = String(form.get("receivedAt") ?? "");

  const receivedAt = parseDateOnly(receivedAtStr);
  if (!receivedAt) {
    return NextResponse.json({ error: "Datum radnog naloga je obavezan." }, { status: 400 });
  }

  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true, status: true },
  });
  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (order.status === "LOCKED") {
    return NextResponse.json({ error: "Nalog je zaključan." }, { status: 409 });
  }

  const hasServiced = await prisma.workOrderItem.findFirst({
    where: {
      companyId: session.companyId,
      workOrderId: id,
      OR: [{ labelNumber: { not: null } }, { servicedAt: { not: null } }],
    },
    select: { id: true },
  });
  if (hasServiced) {
    return NextResponse.json(
      { error: "Datum radnog naloga se ne može mijenjati nakon što je barem jedan aparat servisiran." },
      { status: 409 }
    );
  }

  await prisma.workOrder.update({
    where: { id },
    data: { receivedAt },
  });

  return NextResponse.redirect(new URL(`/work-orders/${id}`, req.url), { status: 303 });
}

