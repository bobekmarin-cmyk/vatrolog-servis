import { prisma } from "@/lib/prisma";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { isActiveToday } from "@/lib/servicerStatus";
import {
  getCompanyPartOverridesByPartIds,
  listAvailablePartsForCompany,
  partDisplayCode,
  partEffectiveCommon,
  partManufacturerCode,
} from "@/lib/partsCatalog";
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
  /** Ključ za keširanje kataloga na klijentu — isti aparat/tip dijeli katalog. */
  catalogKey: string;
  /** Samo već odabrani dijelovi; puni katalog se dohvaća tek na „Dodaj dio”. */
  seedParts: PickerPart[];
  initialSelectedParts: Array<{ id: string; quantity: number }>;
  /** Samo već odabrane usluge; puna lista se dohvaća tek na „Dodaj uslugu”. */
  seedCustomServices: CustomServiceLite[];
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

/** Katalozi koji se dohvaćaju lijeno, tek kad korisnik otvori izbornik. */
export type ServiceFormCatalogPayload = {
  parts: PickerPart[];
  customServices: CustomServiceLite[];
};

export type ServiceFormLoadError =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "LOCKED"
  | "NO_EXTINGUISHER";

export type ServiceFormLoadResult =
  | { ok: true; data: ServiceFormPayload }
  | { ok: false; code: ServiceFormLoadError; status: number; error: string };

export type ServiceFormCatalogResult =
  | { ok: true; data: ServiceFormCatalogPayload }
  | { ok: false; code: ServiceFormLoadError; status: number; error: string };

type ResolvedItem = NonNullable<Awaited<ReturnType<typeof findServiceItem>>>;

function findServiceItem(itemId: string) {
  return prisma.workOrderItem.findUnique({
    where: { id: itemId },
    include: {
      extinguisher: {
        include: { manufacturer: true, type: { include: { agent: true, construction: true } } },
      },
      servicer: true,
    },
  });
}

type GuardResult<TOrder> =
  | {
      ok: true;
      order: TOrder;
      item: ResolvedItem;
      extinguisher: NonNullable<ResolvedItem["extinguisher"]>;
    }
  | { ok: false; code: ServiceFormLoadError; status: number; error: string };

/** Zajedničke provjere (tenant, zaključan nalog, popunjen aparat). */
function guardServiceItem<TOrder extends { id: string; status: string }>(args: {
  companyId: string;
  order: TOrder | null;
  item: ResolvedItem | null;
}): GuardResult<TOrder> {
  const { companyId, order, item } = args;

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
  return { ok: true, order, item, extinguisher: ex };
}

export function serviceCatalogKey(extinguisher: {
  manufacturerId: string;
  extinguisherTypeId: string | null;
}): string {
  return `${extinguisher.manufacturerId}:${extinguisher.extinguisherTypeId ?? ""}`;
}

/**
 * Podaci koje forma „Servisiraj aparat” treba za prvi prikaz — bez punog
 * kataloga dijelova i liste dodatnih usluga (oni se dohvaćaju lijeno preko
 * `loadServiceFormCatalog` kad korisnik otvori izbornik).
 */
export async function loadServiceFormData(args: {
  companyId: string;
  orderId: string;
  itemId: string;
}): Promise<ServiceFormLoadResult> {
  const { companyId, orderId, itemId } = args;

  const [orderRow, itemRow, servicers] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id: orderId, companyId },
      include: { customer: true },
    }),
    findServiceItem(itemId),
    prisma.user.findMany({
      where: { companyId, active: true, role: "SERVISER" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, activatedAt: true },
    }),
  ]);

  const guard = guardServiceItem({ companyId, order: orderRow, item: itemRow });
  if (!guard.ok) return guard;
  const { order, item, extinguisher: ex } = guard;

  const serviceYear = (order.receivedAt ?? new Date()).getFullYear();

  const [selectedRows, selectedCustomRows] = await Promise.all([
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

  // Prikaz već odabranih dijelova mora biti točan i bez punog kataloga —
  // dovoljni su overrideovi za te dijelove.
  const seedOverrides = await getCompanyPartOverridesByPartIds(prisma, {
    companyId,
    partIds: initialSelectedIds,
  });

  const seedPartsById = new Map<string, PickerPart>();
  for (const row of selectedRows) {
    const p = row.part;
    if (!p || seedPartsById.has(p.id)) continue;
    const ov = seedOverrides.get(p.id) ?? null;
    seedPartsById.set(p.id, {
      id: p.id,
      code: partDisplayCode(p, ov),
      manufacturerCode: partManufacturerCode(p),
      name: p.name,
      unit: p.unit,
      isCustom: !!p.companyId,
      isCommon: partEffectiveCommon(p, ov),
    });
  }

  // Već povezane usluge idu uz slim payload i kad su u međuvremenu deaktivirane
  // ili soft-deletane, kako ne bi nestale iz selekcije.
  const seedCustomServices: CustomServiceLite[] = [];
  for (const r of selectedCustomRows) {
    const cs = r.customService;
    if (!cs || seedCustomServices.some((s) => s.id === r.customServiceId)) continue;
    seedCustomServices.push({
      id: r.customServiceId,
      name: cs.name,
      code: cs.code ?? null,
      price: cs.price ? Number(cs.price) : null,
    });
  }

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
      catalogKey: serviceCatalogKey(ex),
      seedParts: Array.from(seedPartsById.values()),
      initialSelectedParts: selectedRows.map((r) => ({
        id: r.partId,
        quantity: Math.max(1, Math.floor(r.quantity ?? 1)),
      })),
      seedCustomServices,
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

/**
 * Puni katalozi za izbornike „Dodaj dio” i „Dodaj uslugu”. Odvojeni su od
 * `loadServiceFormData` da otvaranje/prefetch drawera ostane jeftin.
 */
export async function loadServiceFormCatalog(args: {
  companyId: string;
  orderId: string;
  itemId: string;
}): Promise<ServiceFormCatalogResult> {
  const { companyId, orderId, itemId } = args;

  const [orderRow, itemRow] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id: orderId, companyId },
      select: { id: true, status: true },
    }),
    findServiceItem(itemId),
  ]);

  const guard = guardServiceItem({ companyId, order: orderRow, item: itemRow });
  if (!guard.ok) return guard;
  const ex = guard.extinguisher;

  // `isCommon` je efektivni favorit: platform Part.common ± tenant override.
  const [availableParts, customServicesDb] = await Promise.all([
    listAvailablePartsForCompany(prisma, {
      companyId,
      manufacturerId: ex.manufacturerId,
      extinguisherTypeId: ex.extinguisherTypeId,
    }),
    prisma.companyCustomService.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, price: true },
    }),
  ]);

  return {
    ok: true,
    data: {
      parts: availableParts.map((a) => ({
        id: a.part.id,
        code: a.displayCode,
        manufacturerCode: a.manufacturerCode,
        name: a.part.name,
        unit: a.part.unit,
        isCustom: a.isCustom,
        isCommon: a.isCommon,
      })),
      customServices: customServicesDb.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code ?? null,
        price: s.price ? Number(s.price) : null,
      })),
    },
  };
}
