import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Samo admin može brisati nalog." }, { status: 403 });
  }

  const { id } = await ctx.params;

  const order = await prisma.workOrder.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, companyId: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  }
  if (order.companyId !== session.companyId) {
    return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  }

  // ✅ BLOKADA: ako postoji ijedna servisirana stavka / naljepnica
  const hasServiced = await prisma.workOrderItem.findFirst({
    where: {
      companyId: session.companyId,
      workOrderId: order.id,
      OR: [{ labelNumber: { not: null } }, { servicedAt: { not: null } }],
    },
    select: { id: true },
  });

  if (hasServiced) {
    return NextResponse.json(
      {
        error:
          "Brisanje nije dopušteno: u nalogu postoji barem jedna servisirana stavka (naljepnica/servis).",
      },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.workOrderItemPart.deleteMany({ where: { workOrderItem: { workOrderId: order.id } } });
    await tx.workOrderItem.deleteMany({ where: { workOrderId: order.id } });
    await tx.documentLog.deleteMany({ where: { workOrderId: order.id } });
    await tx.workOrder.deleteMany({ where: { id: order.id } });
  });

  return NextResponse.json({ ok: true });
}
