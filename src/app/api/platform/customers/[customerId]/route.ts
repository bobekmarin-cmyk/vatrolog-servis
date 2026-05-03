import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";

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

  const lastWorkOrder = await prisma.workOrder.findFirst({
    where: { customerId: c.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, orderNumber: true, status: true, createdAt: true, lockedAt: true },
  });

  const distinctExtinguishers = await prisma.workOrderItem.findMany({
    where: { workOrder: { customerId: c.id } },
    select: { extinguisherId: true },
    distinct: ["extinguisherId"],
  });
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
    lastWorkOrder: lastWorkOrder
      ? {
          id: lastWorkOrder.id,
          orderNumber: lastWorkOrder.orderNumber,
          status: lastWorkOrder.status,
          createdAt: lastWorkOrder.createdAt.toISOString(),
          lockedAt: lastWorkOrder.lockedAt?.toISOString() ?? null,
        }
      : null,
  });
}
