import { prisma } from "@/lib/prisma";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { isActiveToday } from "@/lib/servicerStatus";
import { listAvailablePartsForCompany } from "@/lib/partsCatalog";
import {
  computeFirstUpYear,
  computeNextUpYear,
  computeUpInterval,
} from "@/lib/internalUpRule";
import type { CustomServiceLite } from "@/components/WorkOrderCustomServicesPicker";
import type { PickerPart } from "@/components/WorkOrderPartsPicker";
import type { ServicerPickerEntry } from "@/components/ServicerPickerGrid";

export type ServiceFormPayload = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  itemId: string;
  extinguisherId: string;
  serialNumber: string;
  productionYear: number;
  typeLabel: string;
  manufacturerName: string;
  labelNumber: string;
  serviceLocationText: string;
  servicers: ServicerPickerEntry[];
  initialServicerId: string;
  staleServicerHint: string | null;
  parts: PickerPart[];
  initialSelectedParts: Array<{ id: string; quantity: number }>;
  customServices: CustomServiceLite[];
  initialSelectedCustomServiceIds: string[];
  internalInspection: {
    agentCode: string | null;
    manufacturerName: string;
    productionYear: number;
    serviceYear: number;
    existingNextInternalYear: number | null;
    defaultInternalDone: boolean;
    intervalYears: number;
    ruleLabel: string;
    computedFirstUpYear: number;
    computedNextIfDone: number;
  };
  canReset: boolean;
  alreadyServiced: boolean;
};

export type ServiceFormLoadError =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "LOCKED"
  | "NO_EXTINGUISHER";

export type ServiceFormLoadResult =
  | { ok: true; data: ServiceFormPayload }
  | { ok: false; code: ServiceFormLoadError; status: number; error: string };

/**
 * Svi podaci koje treba forma „Servisiraj aparat”. Dijeli se između drawera
 * (JSON preko API-ja, uz prefetch) i bilo kojeg server rendera iste forme.
 */
export async function loadServiceFormData(args: {
  companyId: string;
  orderId: string;
  itemId: string;
}): Promise<ServiceFormLoadResult> {
  const { companyId, orderId, itemId } = args;

  const [order, item, servicers] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id: orderId, companyId },
      include: { customer: true },
    }),
    prisma.workOrderItem.findUnique({
      where: { id: itemId },
      include: {
        extinguisher: {
          include: { manufacturer: true, type: { include: { agent: true, construction: true } } },
        },
        servicer: true,
      },
    }),
    prisma.user.findMany({
      where: { companyId, active: true, role: "SERVISER" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, activatedAt: true },
    }),
  ]);

  if (!order) {
    return { ok: false, code: "NOT_FOUND", status: 404, error: "Nalog nije pronađen." };
  }
  if (!item || item.workOrderId !== order.id) {
    return { ok: false, code: "NOT_FOUND", status: 404, error: "Stavka nije pronađena." };
  }
  if (item.companyId !== companyId) {
    return { ok: false, code: "FORBIDDEN", status: 403, error: "Nemate ovlasti." };
  }
  if (order.status === "LOCKED") {
    return {
      ok: false,
      code: "LOCKED",
      status: 409,
      error: "Nalog je zaključan — nije moguće mijenjati podatke.",
    };
  }

  const ex = item.extinguisher;
  if (!ex) {
    return {
      ok: false,
      code: "NO_EXTINGUISHER",
      status: 400,
      error: "Stavka nije popunjena. Prvo klikni „Popuni” da se unesu podaci aparata.",
    };
  }

  const serviceYear = (order.receivedAt ?? new Date()).getFullYear();

  const [selectedRows, customServicesDb, selectedCustomRows] = await Promise.all([
    prisma.workOrderItemPart.findMany({
      where: { workOrderItemId: item.id, companyId },
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
      where: { companyId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, price: true },
    }),
    prisma.workOrderItemCustomService.findMany({
      where: { workOrderItemId: item.id, companyId },
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

  // `isCommon` je efektivni favorit: platform Part.common ± tenant override.
  const availableParts = await listAvailablePartsForCompany(prisma, {
    companyId,
    manufacturerId: ex.manufacturerId,
    extinguisherTypeId: ex.extinguisherTypeId,
    seedPartIds: initialSelectedIds,
  });

  const customServices: CustomServiceLite[] = customServicesDb.map((s) => ({
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
    if (isUnavailable && !customServices.some((s) => s.id === r.customServiceId)) {
      customServices.push({
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

  const parts: PickerPart[] = [
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

  const storedServicer = item.servicer;
  const staleServicerHint =
    item.servicerId && storedServicer && !isActiveToday(storedServicer.activatedAt)
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

  return {
    ok: true,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: customerDisplayName(order.customer),
      itemId: item.id,
      extinguisherId: ex.id,
      serialNumber: ex.serialNumber,
      productionYear: ex.productionYear,
      typeLabel: ex.type ? formatExtinguisherTypeName(ex.type) : "—",
      manufacturerName: displayManufacturer(ex.manufacturer),
      labelNumber: item.labelNumber ?? "",
      serviceLocationText: item.serviceLocationText ?? "",
      servicers: servicers.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        activeToday: isActiveToday(s.activatedAt),
      })),
      initialServicerId: item.servicerId ?? "",
      staleServicerHint,
      parts,
      initialSelectedParts: selectedRows.map((r) => ({
        id: r.partId,
        quantity: Math.max(1, Math.floor(r.quantity ?? 1)),
      })),
      customServices,
      initialSelectedCustomServiceIds: Array.from(
        new Set(selectedCustomRows.map((r) => r.customServiceId)),
      ),
      internalInspection: {
        agentCode: ex.type?.agent?.code ?? null,
        manufacturerName: displayManufacturer(ex.manufacturer),
        productionYear: ex.productionYear,
        serviceYear,
        existingNextInternalYear: ex.nextInternalDue ? ex.nextInternalDue.getFullYear() : null,
        defaultInternalDone: !!item.internalDone,
        intervalYears: upRule.years,
        ruleLabel: upRule.ruleLabel,
        computedFirstUpYear: computeFirstUpYear(ex.productionYear, upRule.years),
        computedNextIfDone: computeNextUpYear(serviceYear, upRule.years),
      },
      canReset: !!(item.periodicDone || item.servicedAt || item.internalDone),
      alreadyServiced: !!item.servicedAt,
    },
  };
}
