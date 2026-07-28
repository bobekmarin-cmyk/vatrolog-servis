import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { customerDisplayName } from "@/lib/customerDisplay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Podaci za drawer „Popuni placeholder” / „Uredi podatke aparata”.
 *
 * Mode se određuje na serveru (placeholder → fill, inače edit) da klijent ne
 * može tražiti popis proizvođača za nešto što nije njegovo.
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

  const types = await prisma.extinguisherType.findMany({
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      agent: { select: { code: true, label: true, symbol: true } },
      construction: { select: { code: true, label: true } },
    },
  });

  // Fill koristi samo proizvođače za koje tvrtka ima aktivno ovlaštenje;
  // edit prikazuje sve da se postojeći aparat može ispraviti.
  const manufacturers =
    mode === "fill"
      ? (
          await prisma.companyManufacturerAuthorization.findMany({
            where: { companyId: session.companyId, active: true },
            include: {
              manufacturer: {
                include: { supportedTypes: { select: { extinguisherTypeId: true } } },
              },
            },
          })
        )
          .map((a) => a.manufacturer)
          .sort((a, b) => {
            const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
            if (so !== 0) return so;
            return a.name.localeCompare(b.name, "hr");
          })
      : await prisma.manufacturer.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { supportedTypes: { select: { extinguisherTypeId: true } } },
        });

  const ext = item.extinguisher;

  return NextResponse.json({
    ok: true,
    mode,
    orderNumber: order.orderNumber,
    customerName: customerDisplayName(order.customer),
    manufacturers: manufacturers.map((m) => ({
      id: m.id,
      name: m.name,
      supportedTypes: m.supportedTypes.map((s) => ({ extinguisherTypeId: s.extinguisherTypeId })),
    })),
    types,
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
