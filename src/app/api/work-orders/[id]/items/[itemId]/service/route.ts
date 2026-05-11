import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { calcValidUntil } from "@/lib/validity";
import { computeUpInterval } from "@/lib/internalUpRule";
import {
  buildWorkOrderPartSnapshot,
  getCompanyPartOverridesByPartIds,
  getEnabledPlatformManufacturers,
  partActiveForCompany,
} from "@/lib/partsCatalog";

import { redirectRelative } from "@/lib/httpRedirect";
/** Zadnji dan istog mjeseca kao referenceDate, ali u danoj godini (npr. za usklađivanje UP roka s PP mjesecom). */
function sameMonthEndAs(referenceDate: Date, year: number): Date {
  const month = referenceDate.getMonth();
  const d = new Date(year, month + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const form = await req.formData();
  const isScrap = form.get("scrap") === "on";
  const scrapReason = String(form.get("scrapReason") || "").trim();

  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (order.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  if (order.status === "LOCKED") {
    return NextResponse.json({ error: "Nalog je zaključan." }, { status: 409 });
  }

  const item = await prisma.workOrderItem.findUnique({
    where: { id: itemId },
    include: {
      extinguisher: {
        include: { manufacturer: true, type: { include: { agent: true, construction: true } } },
      },
    },
  });

  if (!item) return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
  if (item.workOrderId !== id) return NextResponse.json({ error: "Stavka nije pronađena." }, { status: 404 });
  if (item.companyId !== session.companyId) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });

  if (!item.extinguisherId || !item.extinguisher) {
    return NextResponse.json(
      { error: "Stavka nije popunjena (nema aparata)." },
      { status: 400 }
    );
  }

  const ex = item.extinguisher;
  const now = new Date();
  const serviceDate = order.receivedAt ?? now;

  // ——— RASHOD APARATA ———
  if (isScrap) {
    if (!scrapReason) {
      return NextResponse.json(
        { error: "Razlog rashoda je obavezan." },
        { status: 400 }
      );
    }
    if (ex.status === "SCRAPPED") {
      return NextResponse.json(
        { error: "Aparat je već rashodovan." },
        { status: 400 }
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.extinguisher.update({
        where: { id: ex.id },
        data: {
          status: "SCRAPPED",
          scrappedAt: now,
          scrapReason,
        },
      });
      await tx.workOrderItem.update({
        where: { id: itemId },
        data: {
          servicedAt: serviceDate,
          labelNumber: null,
          servicerId: null,
          partsText: null,
          serviceLocationText: null,
          periodicDone: false,
          internalDone: false,
          internalDoneAt: null,
          nextPeriodicDue: null,
          nextInternalDue: null,
        },
      });
      await tx.workOrderItemPart.deleteMany({ where: { workOrderItemId: itemId } });
      await tx.workOrderItemCustomService.deleteMany({ where: { workOrderItemId: itemId } });
    });
    return redirectRelative(`/work-orders/${id}`, 307);
  }

  // ——— NORMALNI SERVIS ———
  const servicerId = String(form.get("servicerId") || "");
  const labelNumber = String(form.get("labelNumber") || "").trim();
  const partsText = String(form.get("partsText") || "").trim();
  const serviceLocationText = String(form.get("serviceLocationText") || "").trim();
  const internalDone = form.get("internalDone") === "on";
  const nextInternalYearRaw = String(form.get("nextInternalYear") || "").trim();
  const partIdsRaw = form.getAll("partIds").map((x) => String(x ?? "").trim()).filter(Boolean);
  const partIds = Array.from(new Set(partIdsRaw));

  const customServiceIdsRaw = form
    .getAll("customServiceIds")
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  const customServiceIds = Array.from(new Set(customServiceIdsRaw));

  if (!servicerId || !labelNumber) {
    return NextResponse.json(
      { error: "Serviser i naljepnica su obavezni." },
      { status: 400 }
    );
  }

  const servicerOk = await prisma.user.findFirst({
    where: { id: servicerId, companyId: session.companyId, active: true },
    select: { id: true },
  });
  if (!servicerOk) {
    return NextResponse.json({ error: "Serviser nije pronađen (ili nije u tvojoj tvrtki)." }, { status: 400 });
  }

  // duplikat naljepnice (baza ima @unique ali ostavimo lijep error)
  const existing = await prisma.workOrderItem.findFirst({
    where: { companyId: session.companyId, labelNumber, NOT: { id: itemId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Naljepnica ${labelNumber} već postoji u bazi.` },
      { status: 409 }
    );
  }

  // Dohvati Part zapise (i njihove overrideove) za sve odabrane partIds.
  // Validiramo:
  //  - dio postoji i pripada ovom proizvođaču + tipu aparata
  //  - tenant ima pristup tom dijelu (vlastiti ili platform s uključenim katalogom)
  //  - dio je aktivan ILI je već odabran ranije (čuva se povijest)
  const partsInDb =
    partIds.length > 0
      ? await prisma.part.findMany({
          where: {
            id: { in: partIds },
            manufacturerId: ex.manufacturerId,
            types: { some: { extinguisherTypeId: ex.extinguisherTypeId } },
            OR: [{ companyId: null }, { companyId: session.companyId }],
          },
          select: {
            id: true,
            companyId: true,
            manufacturerId: true,
            code: true,
            manufacturerCode: true,
            name: true,
            active: true,
            defaultPrice: true,
          },
        })
      : [];

  const overrides = await getCompanyPartOverridesByPartIds(prisma, {
    companyId: session.companyId,
    partIds: partsInDb.map((p) => p.id),
  });

  const enabledPlatform = await getEnabledPlatformManufacturers(prisma, {
    companyId: session.companyId,
    manufacturerIds: [ex.manufacturerId],
  });
  const platformEnabledForManu = enabledPlatform.has(ex.manufacturerId);

  // Pre-postojeća selekcija — ti dijelovi smiju ostati i kad više nisu dostupni.
  const previouslySelected = await prisma.workOrderItemPart.findMany({
    where: { workOrderItemId: itemId, companyId: session.companyId },
    select: { partId: true },
  });
  const previouslySelectedIds = new Set(previouslySelected.map((p) => p.partId));

  if (partIds.length > 0) {
    const okSet = new Set(partsInDb.map((x) => x.id));
    const invalid = partIds.filter((id) => !okSet.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Odabrani dijelovi nisu validni za ovaj aparat." },
        { status: 400 },
      );
    }

    for (const p of partsInDb) {
      const ov = overrides.get(p.id) ?? null;
      const isCustom = p.companyId !== null;
      const inCatalog = isCustom || platformEnabledForManu;
      const active = partActiveForCompany(p, ov);
      const wasAlreadySelected = previouslySelectedIds.has(p.id);
      if ((!inCatalog || !active) && !wasAlreadySelected) {
        return NextResponse.json(
          { error: `Dio "${p.name}" više nije dostupan u katalogu — uključite ga u Postavke → Rezervni dijelovi.` },
          { status: 400 },
        );
      }
    }
  }

  if (customServiceIds.length > 0) {
    const okCustom = await prisma.companyCustomService.findMany({
      where: {
        id: { in: customServiceIds },
        companyId: session.companyId,
        deletedAt: null,
      },
      select: { id: true },
    });
    const okSet = new Set(okCustom.map((x) => x.id));
    const invalid = customServiceIds.filter((id) => !okSet.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Odabrane dodatne usluge nisu validne." },
        { status: 400 },
      );
    }
  }

  // PERIODIČNI (PP): kraj mjeseca datuma radnog naloga + 1 godina
  const nextPeriodicDue = calcValidUntil(serviceDate);


  // UNUTARNJI (UP): pravilo je definirano per-tip aparata.
  // CO2 override (svakih 5 god) i dalje vrijedi.
  // Prvi UP = productionYear + interval; iduci UP = serviceYear + interval.
  const upRule = ex.type
    ? computeUpInterval({
        extinguisherType: {
          internalRuleMode: ex.type.internalRuleMode,
          internalIntervalYears: ex.type.internalIntervalYears,
          internalOldThresholdYears: ex.type.internalOldThresholdYears,
          internalOldIntervalYears: ex.type.internalOldIntervalYears,
          internalYoungIntervalYears: ex.type.internalYoungIntervalYears,
        },
        agentCode: ex.type.agent?.code ?? null,
        productionYear: ex.productionYear,
        baseYear: serviceDate.getFullYear(),
      })
    : {
        years: 4,
        ruleLabel: "Fallback fiksni interval 4 god (aparat nema definirani tip)",
        source: "FALLBACK" as const,
        origin: "fallback" as const,
      };
  const internalIntervalYears = upRule.years;

  let manualNextInternalDue: Date | null = null;
  if (nextInternalYearRaw) {
    const y = Number(nextInternalYearRaw);
    if (!Number.isFinite(y) || y < 1900 || y > 2100) {
      return NextResponse.json({ error: "Godina idućeg UP-a mora biti valjana (npr. 2030)." }, { status: 400 });
    }
    manualNextInternalDue = sameMonthEndAs(nextPeriodicDue, y);
  }

  // UNUTARNJI (UP) - pravila:
  // - ako postoji već spremljen nextInternalDue na aparatu => koristimo ga
  // - ako je internalDone => računamo automatski po pravilima
  // - rok UP-a: isti mjesec kao periodični (npr. kraj veljače), godina po pravilima
  const firstDueYear = ex.productionYear + internalIntervalYears;
  const computedFirstDue = sameMonthEndAs(nextPeriodicDue, firstDueYear);

  const effectiveLastInternalAt = internalDone ? serviceDate : ex.lastInternalAt;
  const nextInternalYear = serviceDate.getFullYear() + internalIntervalYears;
  const computedNextInternalAfterDone = sameMonthEndAs(nextPeriodicDue, nextInternalYear);

  if (!internalDone && !ex.nextInternalDue && !manualNextInternalDue) {
    return NextResponse.json(
      {
        error:
          "Aparat nema evidentiran idući UP. Upiši godinu idućeg UP-a ili označi da je unutarnji pregled odrađen.",
      },
      { status: 400 }
    );
  }

  const effectiveNextInternalDue = internalDone
    ? computedNextInternalAfterDone
    : ex.nextInternalDue ?? manualNextInternalDue ?? computedFirstDue;

  await prisma.$transaction(async (tx) => {
    // 1) update WorkOrderItem
    await tx.workOrderItem.update({
      where: { id: itemId },
      data: {
        servicerId,
        labelNumber,
        partsText: partsText || null,
        serviceLocationText: serviceLocationText || null,

        periodicDone: true,
        internalDone,
        internalDoneAt: internalDone ? serviceDate : null,

        servicedAt: serviceDate,
        nextPeriodicDue,
        nextInternalDue: effectiveNextInternalDue,
      },
    });

    // 2) sync parts (structured + snapshot)
    await tx.workOrderItemPart.deleteMany({ where: { workOrderItemId: itemId } });
    if (partIds.length > 0) {
      const partById = new Map(partsInDb.map((p) => [p.id, p]));
      await tx.workOrderItemPart.createMany({
        data: partIds.map((partId) => {
          const p = partById.get(partId);
          if (!p) {
            // Defensive — već smo validirali, ali ostavimo siguran fallback.
            return {
              companyId: session.companyId,
              workOrderItemId: itemId,
              partId,
            };
          }
          const ov = overrides.get(partId) ?? null;
          const snap = buildWorkOrderPartSnapshot(p, ov);
          return {
            companyId: session.companyId,
            workOrderItemId: itemId,
            partId,
            unitPrice: snap.unitPrice,
            snapshotCode: snap.snapshotCode,
            snapshotManufacturerCode: snap.snapshotManufacturerCode,
            snapshotName: snap.snapshotName,
            snapshotIsCustom: snap.snapshotIsCustom,
          };
        }),
        skipDuplicates: true,
      });
    }

    // 2b) sync custom (slobodne) services
    await tx.workOrderItemCustomService.deleteMany({ where: { workOrderItemId: itemId } });
    if (customServiceIds.length > 0) {
      await tx.workOrderItemCustomService.createMany({
        data: customServiceIds.map((customServiceId) => ({
          companyId: session.companyId,
          workOrderItemId: itemId,
          customServiceId,
        })),
        skipDuplicates: true,
      });
    }

    // 3) update Extinguisher agregate
    await tx.extinguisher.update({
      where: { id: ex.id },
      data: {
        lastPeriodicAt: serviceDate,
        nextPeriodicDue,

        ...(internalDone
          ? {
              lastInternalAt: serviceDate,
              nextInternalDue: effectiveNextInternalDue,
            }
          : {
              // ako nije odrađen unutarnji, samo ažuriraj nextInternalDue ako do sad nije postojao
              nextInternalDue: ex.nextInternalDue ?? effectiveNextInternalDue,
              lastInternalAt: effectiveLastInternalAt ?? null,
            }),
      },
    });
  });

  return redirectRelative(`/work-orders/${id}`, 307);
}
