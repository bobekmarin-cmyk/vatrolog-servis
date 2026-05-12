import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  let body: { internalCode?: unknown; force?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const internalCode = typeof body.internalCode === "string" ? body.internalCode.trim() : "";
  const force = body.force === true;

  if (!internalCode) {
    return NextResponse.json(
      { error: "Prazan QR kod / interni broj." },
      { status: 400 }
    );
  }

  const order = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      companyId: true,
      customerId: true,
      customer: { select: { name: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  }
  if (order.companyId !== session.companyId) {
    return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  }
  if (order.status === "LOCKED") {
    return NextResponse.json(
      { error: "Nalog je zaključan.", reason: "locked" },
      { status: 409 }
    );
  }

  const extinguisher = await prisma.extinguisher.findUnique({
    where: {
      companyId_internalCode: {
        companyId: session.companyId,
        internalCode,
      },
    },
    select: {
      id: true,
      internalCode: true,
      status: true,
      nextPeriodicDue: true,
      deletedAt: true,
      manufacturer: { select: { name: true, displayName: true } },
      type: { select: { name: true, code: true } },
    },
  });

  if (!extinguisher || extinguisher.deletedAt) {
    return NextResponse.json(
      {
        error: "Aparat s tim internim brojem nije pronađen.",
        reason: "not_found",
        internalCode,
      },
      { status: 404 }
    );
  }

  if (extinguisher.status === "SCRAPPED") {
    return NextResponse.json(
      {
        error: "Aparat je rashodovan i ne može se dodati u nalog.",
        reason: "scrapped",
        internalCode,
      },
      { status: 409 }
    );
  }

  const duplicate = await prisma.workOrderItem.findFirst({
    where: {
      workOrderId: id,
      extinguisherId: extinguisher.id,
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      {
        error: "Aparat je već u ovom nalogu.",
        reason: "already_in_order",
        internalCode,
      },
      { status: 409 }
    );
  }

  // Provjera "vlasnika": izvedeno iz zadnjeg radnog naloga tog aparata u
  // drugom nalogu iste tvrtke. Extinguisher nema customerId.
  if (!force) {
    const lastOtherItem = await prisma.workOrderItem.findFirst({
      where: {
        companyId: session.companyId,
        extinguisherId: extinguisher.id,
        workOrderId: { not: id },
      },
      orderBy: { createdAt: "desc" },
      select: {
        workOrder: {
          select: {
            customerId: true,
            customer: { select: { name: true } },
          },
        },
      },
    });

    if (
      lastOtherItem &&
      lastOtherItem.workOrder.customerId !== order.customerId
    ) {
      return NextResponse.json(
        {
          reason: "customer_mismatch",
          internalCode,
          ownerCustomerName: lastOtherItem.workOrder.customer?.name ?? null,
          orderCustomerName: order.customer?.name ?? null,
        },
        { status: 409 }
      );
    }
  }

  const created = await prisma.workOrderItem.create({
    data: {
      companyId: session.companyId,
      workOrderId: id,
      extinguisherId: extinguisher.id,
      isPlaceholder: false,
      fromInitialReceipt: false,
      targetPeriodicMonth: extinguisher.nextPeriodicDue,
    },
    select: { id: true },
  });

  const audit = extractAuditMeta(req);
  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "workOrderItem.scanAdd",
    entity: "WorkOrderItem",
    entityId: created.id,
    meta: {
      internalCode: extinguisher.internalCode,
      extinguisherId: extinguisher.id,
      workOrderId: id,
      forced: force,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({
    ok: true,
    itemId: created.id,
    internalCode: extinguisher.internalCode,
    manufacturerName: extinguisher.manufacturer ? displayManufacturer(extinguisher.manufacturer) : null,
    typeName: extinguisher.type?.name ?? null,
    typeCode: extinguisher.type?.code ?? null,
  });
}
