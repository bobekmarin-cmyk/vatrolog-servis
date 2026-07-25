import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { customerDisplayName } from "@/lib/customerDisplay";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { customerId } = await params;

  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      company: { select: { id: true, name: true, serviceCode: true } },
      _count: {
        select: {
          workOrders: true,
          backlogSnoozes: true,
          emailLogs: true,
        },
      },
    },
  });
  if (!c) return NextResponse.json({ error: "Kupac nije pronađen." }, { status: 404 });

  const [recentWorkOrders, distinctExtinguishers, siblingCustomers, ownerOrg] = await Promise.all([
    prisma.workOrder.findMany({
      where: { customerId: c.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        lockedAt: true,
        deliveryNotes: {
          where: { supersededAt: null, pdfStoragePath: { not: null } },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.workOrderItem.findMany({
      where: { workOrder: { customerId: c.id } },
      select: { extinguisherId: true },
      distinct: ["extinguisherId"],
    }),
    prisma.customer.findMany({
      where: { oib: c.oib, id: { not: c.id }, deletedAt: null },
      orderBy: [{ company: { serviceCode: "asc" } }],
      select: {
        id: true,
        name: true,
        shortName: true,
        company: { select: { id: true, name: true, serviceCode: true } },
        ownerLink: { select: { status: true, hiddenByVendorAt: true } },
        _count: { select: { workOrders: true } },
      },
    }),
    prisma.ownerOrg.findUnique({
      where: { oib: c.oib },
      select: { id: true, name: true },
    }),
  ]);
  const extinguisherCount = distinctExtinguishers.filter((x) => !!x.extinguisherId).length;

  await prisma.auditLog.create({
    data: {
      companyId: c.companyId,
      actorType: "PLATFORM",
      action: "platform.customer.view",
      entity: "Customer",
      entityId: c.id,
      meta: { name: c.name, oib: c.oib },
    },
  });

  return NextResponse.json({
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    oib: c.oib,
    type: c.type,
    address: c.address,
    city: c.city,
    postalCode: c.postalCode,
    email: c.email,
    phone: c.phone,
    autoNotify: c.autoNotify,
    deletedAt: c.deletedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    company: c.company,
    counts: {
      ...c._count,
      extinguishers: extinguisherCount,
    },
    recentWorkOrders: recentWorkOrders.map((wo) => ({
      id: wo.id,
      orderNumber: wo.orderNumber,
      status: wo.status,
      createdAt: wo.createdAt.toISOString(),
      lockedAt: wo.lockedAt?.toISOString() ?? null,
      hasShippedDeliveryNote: wo.deliveryNotes.length > 0,
    })),
    otherServicers: siblingCustomers.map((s) => ({
      id: s.id,
      displayName: customerDisplayName(s),
      company: s.company,
      workOrderCount: s._count.workOrders,
      portalStatus: s.ownerLink?.status ?? null,
      portalHidden: !!s.ownerLink?.hiddenByVendorAt,
    })),
    ownerOrg: ownerOrg ? { id: ownerOrg.id, name: ownerOrg.name } : null,
  });
}
