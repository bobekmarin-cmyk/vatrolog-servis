import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const form = await req.formData();
  const manufacturerId = String(form.get("manufacturerId") || "").trim();
  const extinguisherTypeId = String(form.get("extinguisherTypeId") || "").trim();
  const serialNumber = String(form.get("serialNumber") || "").trim();
  const productionYear = Number(form.get("productionYear") || 0);
  const typeDescription = String(form.get("typeDescription") || "").trim();
  const serviceLocationText = String(form.get("serviceLocationText") || "").trim();

  if (!manufacturerId || !extinguisherTypeId || !serialNumber || !productionYear) {
    return NextResponse.json(
      { error: "Proizvođač, tip aparata, serijski broj i godina proizvodnje su obavezni." },
      { status: 400 }
    );
  }

  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (order.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  if (order.status === "LOCKED") {
    return NextResponse.json({ error: "Nalog je zaključan." }, { status: 409 });
  }

  const item = await prisma.workOrderItem.findUnique({
    where: { id: itemId },
    select: { id: true, workOrderId: true, companyId: true, extinguisherId: true },
  });
  if (!item) return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
  if (item.workOrderId !== id) return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
  if (item.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  if (!item.extinguisherId) {
    return NextResponse.json({ error: "Stavka nema povezan aparat. Koristi Popuni za unos." }, { status: 400 });
  }

  await prisma.extinguisher.update({
    where: { id: item.extinguisherId },
    data: {
      manufacturerId,
      extinguisherTypeId,
      serialNumber,
      productionYear,
      typeDescription: typeDescription || null,
    },
  });

  await prisma.workOrderItem.update({
    where: { id: itemId },
    data: { serviceLocationText: serviceLocationText || null },
  });

  return NextResponse.redirect(new URL(`/work-orders/${id}`, req.url));
}
