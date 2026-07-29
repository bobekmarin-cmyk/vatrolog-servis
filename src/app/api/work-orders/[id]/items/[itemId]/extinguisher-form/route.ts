import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { customerDisplayName } from "@/lib/customerDisplay";
import { loadExtinguisherFormCatalog } from "@/lib/extinguisherFormCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Podaci za drawer (fallback / stari klijenti). Preferirani put: katalog se
 * učita na stranici naloga pa se drawer otvara bez ovog poziva.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { id, itemId } = await params;

  const [order, item] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id, companyId: session.companyId },
      include: { customer: true },
    }),
    prisma.workOrderItem.findUnique({
      where: { id: itemId },
      include: { extinguisher: true },
    }),
  ]);

  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (!item || item.workOrderId !== order.id) {
    return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
  }
  if (item.companyId !== session.companyId) {
    return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  }
  if (order.status === "LOCKED") {
    return NextResponse.json({ error: "Nalog je zaključan." }, { status: 409 });
  }

  const mode: "fill" | "edit" = item.isPlaceholder || !item.extinguisher ? "fill" : "edit";
  const catalog = await loadExtinguisherFormCatalog(session.companyId);
  const manufacturers = mode === "fill" ? catalog.fillManufacturers : catalog.editManufacturers;
  const ext = item.extinguisher;

  return NextResponse.json({
    ok: true,
    mode,
    orderNumber: order.orderNumber,
    customerName: customerDisplayName(order.customer),
    manufacturers,
    types: catalog.types,
    initial:
      mode === "edit" && ext
        ? {
            internalCode: ext.internalCode,
            manufacturerId: ext.manufacturerId,
            extinguisherTypeId: ext.extinguisherTypeId,
            serialNumber: ext.serialNumber,
            productionYear: ext.productionYear,
            typeDescription: ext.typeDescription,
            serviceLocationText: item.serviceLocationText,
          }
        : null,
  });
}
