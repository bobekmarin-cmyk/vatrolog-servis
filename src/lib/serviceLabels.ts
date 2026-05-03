import type { Prisma, PrismaClient, ServiceLabelKind } from "@prisma/client";
import { displayManufacturer } from "./manufacturerDisplay";

/**
 * Tranzakcijski klijent. `decrementStockForWorkOrder` koristi isti obrazac.
 */
type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type LabelUsageRow = {
  serviceLabelId: string;
  manufacturerId: string;
  kind: ServiceLabelKind;
  quantity: number;
};

/**
 * Mapira code izvedbe (Construction.code) u tip mase naljepnice:
 *  - STORED_PRESSURE ili CO2 → APPARATUS_MASS
 *  - CARTRIDGE            → CYLINDER_MASS
 *  - ostalo               → null (nema mase naljepnice)
 */
function massLabelKindFor(constructionCode: string | null | undefined): ServiceLabelKind | null {
  if (!constructionCode) return null;
  if (constructionCode === "CARTRIDGE") return "CYLINDER_MASS";
  if (constructionCode === "STORED_PRESSURE" || constructionCode === "CO2") return "APPARATUS_MASS";
  return null;
}

/**
 * Izračunava potrošnju servisnih naljepnica za zadani radni nalog.
 * Uzima samo stvarno servisirane stavke:
 *   - isPlaceholder = false
 *   - periodicDone = true
 *   - extinguisherId != null
 * Za svaku stavku:
 *   +1 PERIODIC na proizvođaču aparata
 *   +1 APPARATUS_MASS ili CYLINDER_MASS ovisno o izvedbi
 * Rezultat je grupiran po (serviceLabelId).
 */
export async function computeLabelUsage(
  tx: Tx,
  params: { companyId: string; workOrderId: string },
): Promise<LabelUsageRow[]> {
  const items = await tx.workOrderItem.findMany({
    where: {
      workOrderId: params.workOrderId,
      companyId: params.companyId,
      isPlaceholder: false,
      periodicDone: true,
      extinguisherId: { not: null },
    },
    select: {
      extinguisher: {
        select: {
          manufacturerId: true,
          type: { select: { construction: { select: { code: true } } } },
        },
      },
    },
  });

  if (items.length === 0) return [];

  const tally = new Map<string, { manufacturerId: string; kind: ServiceLabelKind; quantity: number }>();
  function bump(manufacturerId: string, kind: ServiceLabelKind) {
    const key = `${manufacturerId}:${kind}`;
    const entry = tally.get(key);
    if (entry) entry.quantity += 1;
    else tally.set(key, { manufacturerId, kind, quantity: 1 });
  }

  for (const it of items) {
    if (!it.extinguisher) continue;
    const manuId = it.extinguisher.manufacturerId;
    bump(manuId, "PERIODIC");
    const massKind = massLabelKindFor(it.extinguisher.type?.construction?.code ?? null);
    if (massKind) bump(manuId, massKind);
  }

  if (tally.size === 0) return [];

  const manufacturerIds = Array.from(new Set(Array.from(tally.values()).map((e) => e.manufacturerId)));
  const labels = await tx.serviceLabel.findMany({
    where: { manufacturerId: { in: manufacturerIds } },
    select: { id: true, manufacturerId: true, kind: true },
  });
  const labelMap = new Map<string, string>();
  for (const l of labels) {
    labelMap.set(`${l.manufacturerId}:${l.kind}`, l.id);
  }

  const rows: LabelUsageRow[] = [];
  for (const entry of tally.values()) {
    const labelId = labelMap.get(`${entry.manufacturerId}:${entry.kind}`);
    if (!labelId) continue;
    rows.push({
      serviceLabelId: labelId,
      manufacturerId: entry.manufacturerId,
      kind: entry.kind,
      quantity: entry.quantity,
    });
  }
  return rows;
}

/**
 * Zaključavanjem radnog naloga pohrani potrošnju naljepnica i smanji stanje.
 * Idempotentno: prvo pobriše prethodne consumption retke za isti nalog, pa
 * ponovo upiše izračunatu potrošnju.
 * Stanje smije ići u minus.
 */
export async function consumeLabelsOnLock(
  tx: Tx,
  params: { companyId: string; workOrderId: string },
): Promise<{ consumed: number; rows: LabelUsageRow[] }> {
  await tx.workOrderLabelConsumption.deleteMany({
    where: { workOrderId: params.workOrderId },
  });

  const rows = await computeLabelUsage(tx, params);
  let consumed = 0;

  for (const row of rows) {
    await tx.workOrderLabelConsumption.create({
      data: {
        workOrderId: params.workOrderId,
        serviceLabelId: row.serviceLabelId,
        quantity: row.quantity,
      },
    });

    await tx.serviceLabelStock.upsert({
      where: {
        companyId_serviceLabelId: {
          companyId: params.companyId,
          serviceLabelId: row.serviceLabelId,
        },
      },
      create: {
        companyId: params.companyId,
        serviceLabelId: row.serviceLabelId,
        stockQty: -row.quantity,
        minStockQty: 0,
      },
      update: {
        stockQty: { decrement: row.quantity },
      },
    });
    consumed += row.quantity;
  }

  return { consumed, rows };
}

/**
 * Otključavanjem radnog naloga vrati naljepnice na stanje.
 */
export async function revertLabelConsumptionOnUnlock(
  tx: Tx,
  params: { companyId: string; workOrderId: string },
): Promise<{ reverted: number }> {
  const rows = await tx.workOrderLabelConsumption.findMany({
    where: { workOrderId: params.workOrderId },
  });
  let reverted = 0;
  for (const row of rows) {
    await tx.serviceLabelStock.upsert({
      where: {
        companyId_serviceLabelId: {
          companyId: params.companyId,
          serviceLabelId: row.serviceLabelId,
        },
      },
      create: {
        companyId: params.companyId,
        serviceLabelId: row.serviceLabelId,
        stockQty: row.quantity,
        minStockQty: 0,
      },
      update: {
        stockQty: { increment: row.quantity },
      },
    });
    reverted += row.quantity;
  }
  await tx.workOrderLabelConsumption.deleteMany({
    where: { workOrderId: params.workOrderId },
  });
  return { reverted };
}

/**
 * Prikazna projekcija potrošnje naljepnica s pripadnim šiframa iz ovlaštenja.
 * Koristi se za otpremnicu: ako je nalog zaključan → čita snimku iz
 * WorkOrderLabelConsumption, inače kalkulira „live" iz items-a.
 *
 * Vraća grupirano po proizvođaču i kind-u, sa šiframa iz
 * CompanyManufacturerAuthorization.
 */
export type LabelDeliveryRow = {
  manufacturerName: string;
  kind: ServiceLabelKind;
  kindLabel: string;
  code: string | null;
  quantity: number;
};

export async function collectLabelRowsForDeliveryNote(
  db: Tx | PrismaClient,
  params: { companyId: string; workOrderId: string; locked: boolean },
): Promise<LabelDeliveryRow[]> {
  const client = db as PrismaClient;

  let usage: Array<{ serviceLabelId: string; quantity: number }> = [];
  if (params.locked) {
    usage = (
      await client.workOrderLabelConsumption.findMany({
        where: { workOrderId: params.workOrderId },
        select: { serviceLabelId: true, quantity: true },
      })
    ).map((r) => ({ serviceLabelId: r.serviceLabelId, quantity: r.quantity }));
  } else {
    const computed = await computeLabelUsage(client as Tx, {
      companyId: params.companyId,
      workOrderId: params.workOrderId,
    });
    usage = computed.map((r) => ({ serviceLabelId: r.serviceLabelId, quantity: r.quantity }));
  }

  if (usage.length === 0) return [];

  const labels = await client.serviceLabel.findMany({
    where: { id: { in: usage.map((u) => u.serviceLabelId) } },
    select: {
      id: true,
      kind: true,
      manufacturer: { select: { id: true, name: true, displayName: true } },
    },
  });
  const labelById = new Map(labels.map((l) => [l.id, l]));

  const manufacturerIds = Array.from(new Set(labels.map((l) => l.manufacturer.id)));
  const auths = await client.companyManufacturerAuthorization.findMany({
    where: {
      companyId: params.companyId,
      manufacturerId: { in: manufacturerIds },
    },
  });
  const authByManu = new Map(auths.map((a) => [a.manufacturerId, a]));

  const rows: LabelDeliveryRow[] = [];
  for (const u of usage) {
    const lbl = labelById.get(u.serviceLabelId);
    if (!lbl) continue;
    const auth = authByManu.get(lbl.manufacturer.id) ?? null;
    const display = displayManufacturer(lbl.manufacturer);
    const kindLabelFull = kindToFullLabel(lbl.kind as ServiceLabelKind, display);
    const code = codeForKind(lbl.kind as ServiceLabelKind, auth);
    rows.push({
      manufacturerName: display,
      kind: lbl.kind as ServiceLabelKind,
      kindLabel: kindLabelFull,
      code,
      quantity: u.quantity,
    });
  }

  rows.sort((a, b) => {
    const n = a.manufacturerName.localeCompare(b.manufacturerName, "hr");
    if (n !== 0) return n;
    return kindOrder(a.kind) - kindOrder(b.kind);
  });

  return rows;
}

function kindOrder(k: ServiceLabelKind): number {
  switch (k) {
    case "PERIODIC":
      return 0;
    case "APPARATUS_MASS":
      return 1;
    case "CYLINDER_MASS":
      return 2;
  }
}

function kindToFullLabel(kind: ServiceLabelKind, manufacturerName: string): string {
  switch (kind) {
    case "PERIODIC":
      return `Naljepnica periodičnog pregleda (${manufacturerName})`;
    case "APPARATUS_MASS":
      return `Naljepnica mase aparata (${manufacturerName})`;
    case "CYLINDER_MASS":
      return `Naljepnica mase bočice (${manufacturerName})`;
  }
}

function codeForKind(
  kind: ServiceLabelKind,
  auth: Prisma.CompanyManufacturerAuthorizationGetPayload<true> | null,
): string | null {
  if (!auth) return null;
  switch (kind) {
    case "PERIODIC":
      return auth.periodicLabelCode ?? null;
    case "APPARATUS_MASS":
      return auth.apparatusMassLabelCode ?? null;
    case "CYLINDER_MASS":
      return auth.cylinderMassLabelCode ?? null;
  }
}
