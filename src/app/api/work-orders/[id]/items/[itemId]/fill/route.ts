import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { allocateNextInternalCodeTx, getWeightCodeForType } from "@/lib/internalCode";

import { redirectRelative } from "@/lib/httpRedirect";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  // Drawer šalje fetch-om i očekuje JSON; klasična forma i dalje dobiva redirect.
  const wantsJson = (req.headers.get("accept") ?? "").includes("application/json");
  const done = () => (wantsJson ? NextResponse.json({ ok: true }) : redirectRelative(`/work-orders/${id}`, 307));

  const form = await req.formData();

  const internalCode = String(form.get("internalCode") || "").trim();

  const manufacturerId = String(form.get("manufacturerId") || "");
  const extinguisherTypeId = String(form.get("extinguisherTypeId") || "");
  const serialNumber = String(form.get("serialNumber") || "").trim();
  const typeDescription = String(form.get("typeDescription") || "").trim();
  const productionYearRaw = String(form.get("productionYear") || "").trim();
  const productionYear = Number(productionYearRaw);
  const serviceLocationText = String(form.get("serviceLocationText") || "").trim();

  // Ako korisnik upiše interni broj: mora postojati
  if (internalCode) {
    const existing = await prisma.extinguisher.findUnique({
      where: { companyId_internalCode: { companyId: session.companyId, internalCode } },
      select: { id: true, nextPeriodicDue: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Interni broj nije pronađen. Ako je novi aparat, ostavi polje prazno." },
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
      select: {
        id: true,
        workOrderId: true,
        companyId: true,
        targetPeriodicMonth: true,
      },
    });
    if (!item) return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
    if (item.workOrderId !== id) return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
    if (item.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });

    await prisma.workOrderItem.update({
      where: { id: itemId },
      data: {
        isPlaceholder: false,
        extinguisherId: existing.id,
        serviceLocationText: serviceLocationText || null,
        // Snapshot originalnog PP roka — kopira se samo ako već nije postavljen.
        targetPeriodicMonth: item.targetPeriodicMonth ?? existing.nextPeriodicDue,
      },
    });

    return done();
  }

  // Ručni unos (bez internog broja)
  if (!manufacturerId || !extinguisherTypeId || !serialNumber || !productionYear) {
    return NextResponse.json(
      { error: "Sva polja osim lokacije su obavezna." },
      { status: 400 }
    );
  }
  if (!/^(19|20)\d{2}$/.test(productionYearRaw)) {
    return NextResponse.json(
      { error: "Godina proizvodnje mora biti u formatu 19xx ili 20xx." },
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
    select: {
      id: true,
      extinguisherId: true,
      workOrderId: true,
      companyId: true,
      targetPeriodicMonth: true,
    },
  });
  if (!item) return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
  if (item.workOrderId !== id) return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
  if (item.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { serviceCode: true },
  });
  if (!company) return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 500 });

  const authorization = await prisma.companyManufacturerAuthorization.findUnique({
    where: { companyId_manufacturerId: { companyId: session.companyId, manufacturerId } },
    select: { active: true },
  });
  if (!authorization?.active) {
    return NextResponse.json(
      { error: "Nemate aktivno ovlaštenje za odabranog proizvođača." },
      { status: 400 }
    );
  }

  const supportedType = await prisma.manufacturerExtinguisherType.findUnique({
    where: { manufacturerId_extinguisherTypeId: { manufacturerId, extinguisherTypeId } },
    select: { manufacturerId: true },
  });
  if (!supportedType) {
    return NextResponse.json(
      {
        error:
          "Odabrani proizvođač nema unesen taj tip aparata. Odaberi drugog proizvođača ili se javi vendoru.",
      },
      { status: 400 }
    );
  }

  // Snapshot originalnog PP roka aparata prije ikakvog update-a.
  const existingRoles = item.extinguisherId
    ? await prisma.extinguisher.findUnique({
        where: { id: item.extinguisherId },
        select: { nextPeriodicDue: true },
      })
    : null;

  const extinguisher = item.extinguisherId
    ? await prisma.extinguisher.update({
        where: { id: item.extinguisherId },
        data: {
          manufacturerId,
          extinguisherTypeId,
          serialNumber,
          productionYear,
          typeDescription: typeDescription || null,
        },
      })
    : await prisma.$transaction(async (tx) => {
        const weightCode = await getWeightCodeForType(extinguisherTypeId);
        const internalCode = await allocateNextInternalCodeTx(tx, session.companyId, company.serviceCode, weightCode);
        return await tx.extinguisher.create({
          data: {
            companyId: session.companyId,
            internalCode,
            manufacturerId,
            extinguisherTypeId,
            serialNumber,
            productionYear,
            typeDescription: typeDescription || null,
          },
        });
      });

  await prisma.workOrderItem.update({
    where: { id: itemId },
    data: {
      isPlaceholder: false,
      extinguisherId: extinguisher.id,
      serviceLocationText: serviceLocationText || null,
      // Snapshot originalnog PP roka — samo ako nije već postavljen ranije.
      // Novi aparati nemaju nextPeriodicDue, pa ostaje null.
      targetPeriodicMonth: item.targetPeriodicMonth ?? existingRoles?.nextPeriodicDue ?? null,
    },
  });

  return done();
}
