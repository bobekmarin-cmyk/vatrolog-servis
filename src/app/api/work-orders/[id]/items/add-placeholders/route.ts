import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  let countRaw: number;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = await req.json();
    countRaw = Number(body.count ?? 1);
  } else {
    const form = await req.formData();
    countRaw = Number(form.get("count") || 1);
  }

  const count = Number.isFinite(countRaw) ? Math.floor(countRaw) : 1;
  if (count < 1 || count > 200) {
    return NextResponse.json(
      { error: "Broj placeholdera mora biti između 1 i 200." },
      { status: 400 }
    );
  }

  const order = await prisma.workOrder.findUnique({
    where: { id },
    select: { id: true, status: true, companyId: true },
  });

  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (order.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  if (order.status === "LOCKED") {
    return NextResponse.json({ error: "Nalog je zaključan." }, { status: 409 });
  }

  const data = Array.from({ length: count }).map(() => ({
    companyId: session.companyId,
    workOrderId: id,
    isPlaceholder: true,
    fromInitialReceipt: false,
  }));

  await prisma.workOrderItem.createMany({ data });

  return NextResponse.json({ ok: true, added: count });
}
