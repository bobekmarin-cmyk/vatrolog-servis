import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import InternalInspectionSection from "@/components/InternalInspectionSection";
import WorkOrderPartsPicker from "@/components/WorkOrderPartsPicker";
import WorkOrderCustomServicesPicker, {
  type CustomServiceLite,
} from "@/components/WorkOrderCustomServicesPicker";
import ServiceFormWithScrap from "@/components/ServiceFormWithScrap";
import ServicerPickerGrid from "@/components/ServicerPickerGrid";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { isActiveToday } from "@/lib/servicerStatus";
import {
  computeUpInterval,
  computeFirstUpYear,
  computeNextUpYear,
} from "@/lib/internalUpRule";
import { listAvailablePartsForCompany } from "@/lib/partsCatalog";

export default async function ServiceItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id, itemId } = await params;

  const [order, item, servicers] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id, companyId: session.companyId },
      include: { customer: true },
    }),
    prisma.workOrderItem.findUnique({
      where: { id: itemId },
      include: {
        extinguisher: { include: { manufacturer: true, type: { include: { agent: true, construction: true } } } },
        servicer: true,
      },
    }),
    prisma.user.findMany({
      where: {
        companyId: session.companyId,
        active: true,
        role: "SERVISER",
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, activatedAt: true },
    }),
  ]);

  if (!order) notFound();
  if (!item) notFound();
  if (item.workOrderId !== order.id) notFound();
  if (item.companyId !== session.companyId) notFound();

  if (order.status === "LOCKED") {
    return (
      <main className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">Nalog je zaključan</h1>
        <p className="text-gray-600">Nije moguće mijenjati podatke.</p>
        <Link className="inline-block underline" href={`/work-orders/${order.id}`}>
          ← Povratak na Servisni nalog
        </Link>
      </main>
    );
  }

  const ex = item.extinguisher;
  const serviceYear = (order.receivedAt ?? new Date()).getFullYear();

  if (!ex) {
    return (
      <main className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">Stavka nije popunjena</h1>
        <p className="text-gray-600">Prvo klikni “Popuni” da se unesu podaci aparata.</p>
        <Link className="inline-block underline" href={`/work-orders/${order.id}`}>
          ← Povratak na Servisni nalog
        </Link>
      </main>
    );
  }

  // Globalni dijelovi filtrirani po proizvođaču + tipu aparata
  const typeLabel = ex.type ? formatExtinguisherTypeName(ex.type) : "—";

  const [selectedRows, customServicesDb, selectedCustomRows] = await Promise.all([
    prisma.workOrderItemPart.findMany({
      where: { workOrderItemId: item.id, companyId: session.companyId },
      include: {
        part: {
          select: {
            id: true,
            code: true,
            name: true,
            active: true,
            companyId: true,
            manufacturerId: true,
            manufacturerCode: true,
            defaultPrice: true,
            unit: true,
            common: true,
          },
        },
      },
    }),
    prisma.companyCustomService.findMany({
      where: { companyId: session.companyId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, price: true },
    }),
    prisma.workOrderItemCustomService.findMany({
      where: { workOrderItemId: item.id, companyId: session.companyId },
      include: {
        customService: {
          select: {
            id: true,
            name: true,
            code: true,
            price: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    }),
  ]);

  const initialSelectedIds = Array.from(new Set(selectedRows.map((r) => r.partId)));

  // Dohvati dostupne dijelove (i seed već odabranih) prema novim pravilima.
  // `isCommon` je efektivni favorit: platform Part.common ± tenant override.
  const availableParts = await listAvailablePartsForCompany(prisma, {
    companyId: session.companyId,
    manufacturerId: ex.manufacturerId,
    extinguisherTypeId: ex.extinguisherTypeId,
    seedPartIds: initialSelectedIds,
  });

  const initialSelectedCustomServiceIds = Array.from(
    new Set(selectedCustomRows.map((r) => r.customServiceId)),
  );
  const customServicesAvailable: CustomServiceLite[] = customServicesDb.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code ?? null,
    price: s.price ? Number(s.price) : null,
  }));
  // Ako je već povezana usluga u međuvremenu deaktivirana ili soft-deletana,
  // uključi je ipak u dropdown (read-only seed) kako se ne bi izgubila iz selekcije.
  for (const r of selectedCustomRows) {
    const cs = r.customService;
    if (!cs) continue;
    const isUnavailable = !cs.isActive || !!cs.deletedAt;
    if (isUnavailable && !customServicesAvailable.some((s) => s.id === r.customServiceId)) {
      customServicesAvailable.push({
        id: r.customServiceId,
        name: cs.name,
        code: cs.code ?? null,
        price: cs.price ? Number(cs.price) : null,
      });
    }
  }
  // Sigurnosni dodatak: ako je već odabran dio koji više nije u availableParts (npr. obrisan),
  // dodaj ga sa snapshotom iz live Part zapisa kako ne bi nestao iz selekcije.
  const availableIdSet = new Set(availableParts.map((a) => a.part.id));
  const extraSelectedRaw = selectedRows
    .map((r) => r.part)
    .filter((p): p is NonNullable<typeof p> => !!p && !availableIdSet.has(p.id));

  const partsForPicker = [
    ...availableParts.map((a) => ({
      id: a.part.id,
      code: a.displayCode,
      manufacturerCode: a.manufacturerCode,
      name: a.part.name,
      unit: a.part.unit,
      isCustom: a.isCustom,
      isCommon: a.isCommon,
    })),
    ...extraSelectedRaw.map((p) => ({
      id: p.id,
      code: p.code,
      manufacturerCode: p.manufacturerCode,
      name: p.name,
      unit: p.unit,
      isCustom: !!p.companyId,
      isCommon: !!p.common,
    })),
  ];

  const initialSelectedParts = selectedRows.map((r) => ({
    id: r.partId,
    quantity: Math.max(1, Math.floor(r.quantity ?? 1)),
  }));

  const servicersForPicker = servicers.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    activeToday: isActiveToday(s.activatedAt),
  }));

  const storedServicer = item.servicer;
  const staleServicerHint =
    item.servicerId &&
    storedServicer &&
    !isActiveToday(storedServicer.activatedAt)
      ? `Na stavci je bio odabran ${storedServicer.fullName}, koji danas nije prijavljen — odaberite drugog ili ga aktivirajte u izborniku „Serviseri”.`
      : null;

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
        baseYear: serviceYear,
      })
    : ({
        years: 4,
        ruleLabel: "Fallback fiksni interval 4 god (aparat nema definirani tip)",
        source: "FALLBACK" as const,
        origin: "fallback" as const,
      });
  const computedFirstUpYear = computeFirstUpYear(ex.productionYear, upRule.years);
  const computedNextIfDone = computeNextUpYear(serviceYear, upRule.years);

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold leading-none">Servisiraj aparat</h1>
            <span className="text-lg font-medium leading-none text-slate-600">{order.orderNumber}</span>
            <span className="text-lg font-medium leading-none text-slate-600">{customerDisplayName(order.customer)}</span>
          </div>
          <div className="mt-2">
            <Link className="btn btn-outline px-3 py-1 text-xs" href={`/extinguishers/${ex.id}/qr-label`} target="_blank" rel="noreferrer">
              Ispiši QR naljepnicu
            </Link>
          </div>
        </div>

        <div className="surface px-4 py-3 xl:w-1/3">
          <div className="space-y-1 text-center">
            <div className="font-mono text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {ex.serialNumber}/{ex.productionYear}
            </div>
            <div className="text-sm text-slate-700">
              <span className="font-bold text-slate-900">
                {ex.type ? formatExtinguisherTypeName(ex.type) : "—"}
              </span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-600">{displayManufacturer(ex.manufacturer)}</span>
            </div>
          </div>
        </div>
      </div>

      <ServiceFormWithScrap
        action={`/api/work-orders/${order.id}/items/${item.id}/service`}
        resetAction={`/api/work-orders/${order.id}/items/${item.id}/reset`}
        canReset={!!(item.periodicDone || item.servicedAt || item.internalDone)}
        workOrderId={order.id}
        labelLeft={
          <div className="space-y-3">
            <label className="label flex flex-wrap items-center gap-2" htmlFor="labelNumber">
              <span>Broj naljepnice (unikatan)</span>
              <button
                type="button"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[10px] font-bold leading-none text-slate-600 hover:bg-slate-100"
                title="Naljepnica mora biti jedinstvena kroz cijelu bazu."
                aria-label="Informacija: naljepnica mora biti jedinstvena kroz cijelu bazu."
              >
                i
              </button>
            </label>
            <input
              id="labelNumber"
              name="labelNumber"
              className="input"
              defaultValue={item.labelNumber ?? ""}
              required
            />
          </div>
        }
        servicerLocationLeft={
          <>
            <div className="space-y-3">
              <label className="label flex flex-wrap items-center gap-2">
                <span>Serviser</span>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[10px] font-bold leading-none text-slate-600 hover:bg-slate-100"
                  title="Odaberi servisera koji je prijavljen za današnji dan. Neaktivni serviseri su zasivljeni."
                  aria-label="Informacija: odaberi servisera koji je prijavljen za današnji dan."
                >
                  i
                </button>
              </label>
              <ServicerPickerGrid
                servicers={servicersForPicker}
                initialServicerId={item.servicerId ?? ""}
                staleServicerHint={staleServicerHint}
              />
            </div>

            <div className="space-y-3">
              <label className="label flex flex-wrap items-center gap-2">
                <span>Lokacija</span>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[10px] font-bold leading-none text-slate-600 hover:bg-slate-100"
                  title="Opcionalna lokacija ili napomena koja se zapisuje na upisniku."
                  aria-label="Informacija: opcionalna lokacija ili napomena koja se zapisuje na upisniku."
                >
                  i
                </button>
              </label>
              <input name="serviceLocationText" className="input" defaultValue={item.serviceLocationText ?? ""} />
            </div>
          </>
        }
        internalInspectionLeft={
          <InternalInspectionSection
            agentCode={ex.type?.agent?.code ?? null}
            manufacturerName={displayManufacturer(ex.manufacturer)}
            productionYear={ex.productionYear}
            serviceYear={serviceYear}
            existingNextInternalYear={ex.nextInternalDue ? ex.nextInternalDue.getFullYear() : null}
            defaultInternalDone={!!item.internalDone}
            intervalYears={upRule.years}
            ruleLabel={upRule.ruleLabel}
            computedFirstUpYear={computedFirstUpYear}
            computedNextIfDone={computedNextIfDone}
          />
        }
        rightContent={
          <>
            <WorkOrderPartsPicker
              kind={typeLabel}
              parts={partsForPicker}
              initialSelected={initialSelectedParts}
            />

            <div>
              <WorkOrderCustomServicesPicker
                available={customServicesAvailable}
                initialSelectedIds={initialSelectedCustomServiceIds}
              />
            </div>
          </>
        }
      />
    </main>
  );
}

