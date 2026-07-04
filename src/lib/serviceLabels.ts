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

  // Defensive auto-create: ako za neki (manufacturerId, kind) iz tally-ja ne
  // postoji ServiceLabel zapis (npr. zato što je proizvođač kreiran prije nego
  // što je auto-popunjavanje uvedeno, ili kroz seed bez ServiceLabel-ova),
  // stvori ga sada da se naljepnice ne propuste s otpremnice.
  const missing: { manufacturerId: string; kind: ServiceLabelKind }[] = [];
  for (const entry of tally.values()) {
    if (!labelMap.has(`${entry.manufacturerId}:${entry.kind}`)) {
      missing.push({ manufacturerId: entry.manufacturerId, kind: entry.kind });
    }
  }
  if (missing.length > 0) {
    await tx.serviceLabel.createMany({ data: missing, skipDuplicates: true });
    const created = await tx.serviceLabel.findMany({
      where: { manufacturerId: { in: missing.map((m) => m.manufacturerId) } },
      select: { id: true, manufacturerId: true, kind: true },
    });
    for (const l of created) {
      labelMap.set(`${l.manufacturerId}:${l.kind}`, l.id);
    }
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
 * Idempotentno / diff-safe: eventualna prethodna potrošnja (npr. vendor je
 * otključao nalog bez storniranja) prvo se vrati na stanje, pa se upiše i
 * skine nova izračunata potrošnja — neto efekt je razlika.
 * Stanje smije ići u minus.
 */
export async function consumeLabelsOnLock(
  tx: Tx,
  params: { companyId: string; workOrderId: string },
): Promise<{ consumed: number; rows: LabelUsageRow[] }> {
  await revertLabelConsumptionOnUnlock(tx, params);

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
 * Grupiranje per kind (PERIODIC / APPARATUS_MASS / CYLINDER_MASS):
 *   - Ako svi proizvođači u toj kind imaju ISTU non-null šifru (i postoji
 *     bar 2 proizvođača za tu kind ili je šifra zadana), vraća se JEDAN
 *     red bez manufacturer-a u nazivu, sa zbrojenom količinom i zajedničkom
 *     šifrom.
 *   - Inače: per-manufacturer redovi s nazivom "Naljepnica … (PASTOR …)".
 */
export type LabelDeliveryRow = {
  /** Prazan string kad je red grupiran preko više proizvođača. */
  manufacturerName: string;
  kind: ServiceLabelKind;
  kindLabel: string;
  code: string | null;
  quantity: number;
  /** true ako red predstavlja zbroj kroz više proizvođača iste kind sa zajedničkom šifrom. */
  grouped: boolean;
};

type RawRow = {
  manufacturerId: string;
  manufacturerName: string;
  manufacturerSortOrder: number;
  kind: ServiceLabelKind;
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

  const [labels, company] = await Promise.all([
    client.serviceLabel.findMany({
      where: { id: { in: usage.map((u) => u.serviceLabelId) } },
      select: {
        id: true,
        kind: true,
        manufacturer: { select: { id: true, name: true, displayName: true, sortOrder: true } },
      },
    }),
    client.company.findUnique({
      where: { id: params.companyId },
      select: {
        labelCodeStrategy: true,
        sharedPeriodicLabelCode: true,
        sharedApparatusMassLabelCode: true,
        sharedCylinderMassLabelCode: true,
      },
    }),
  ]);
  const labelById = new Map(labels.map((l) => [l.id, l]));

  const manufacturerIds = Array.from(new Set(labels.map((l) => l.manufacturer.id)));
  const auths = await client.companyManufacturerAuthorization.findMany({
    where: {
      companyId: params.companyId,
      manufacturerId: { in: manufacturerIds },
    },
  });
  const authByManu = new Map(auths.map((a) => [a.manufacturerId, a]));

  const strategy = company?.labelCodeStrategy ?? "SHARED";

  function sharedCodeFor(kind: ServiceLabelKind): string | null {
    if (!company) return null;
    switch (kind) {
      case "PERIODIC":
        return company.sharedPeriodicLabelCode ?? null;
      case "APPARATUS_MASS":
        return company.sharedApparatusMassLabelCode ?? null;
      case "CYLINDER_MASS":
        return company.sharedCylinderMassLabelCode ?? null;
    }
  }

  const raw: RawRow[] = [];
  for (const u of usage) {
    const lbl = labelById.get(u.serviceLabelId);
    if (!lbl) continue;
    const auth = authByManu.get(lbl.manufacturer.id) ?? null;
    const display = displayManufacturer(lbl.manufacturer);
    const code = codeForKind(lbl.kind as ServiceLabelKind, auth);
    raw.push({
      manufacturerId: lbl.manufacturer.id,
      manufacturerName: display,
      manufacturerSortOrder: lbl.manufacturer.sortOrder ?? 0,
      kind: lbl.kind as ServiceLabelKind,
      code,
      quantity: u.quantity,
    });
  }

  // Strategija određuje prikaz na otpremnici:
  //   SHARED            → uvijek grupirano (jedna stavka po kind-u, bez naziva
  //                       proizvođača, sa zbrojenom količinom). Šifra se uzima
  //                       prvenstveno iz Company.shared* polja, pa iz CMA
  //                       (sve bi trebale biti iste), pa null.
  //   PER_MANUFACTURER  → uvijek per-proizvođač (zasebna stavka po kombinaciji
  //                       proizvođač + kind). Šifra je per-manu iz CMA, može
  //                       biti null ako korisnik nije unio za tog proizvođača.
  const byKind = new Map<ServiceLabelKind, RawRow[]>();
  for (const r of raw) {
    const arr = byKind.get(r.kind) ?? [];
    arr.push(r);
    byKind.set(r.kind, arr);
  }

  const groupedRows: LabelDeliveryRow[] = [];
  const perManuRows: LabelDeliveryRow[] = [];

  if (strategy === "SHARED") {
    for (const [kind, items] of byKind.entries()) {
      const sum = items.reduce((s, i) => s + i.quantity, 0);
      // Prvenstveno Company.shared* polje (jedini istinski izvor u SHARED modu),
      // pa fallback na CMA šifru s prvog item-a koja je obično ista.
      let code = sharedCodeFor(kind);
      if (!code) {
        const firstWithCode = items.find((i) => i.code && i.code.trim().length > 0);
        code = firstWithCode?.code ?? null;
      }
      groupedRows.push({
        manufacturerName: "",
        kind,
        kindLabel: kindToShortLabel(kind),
        code: code && code.trim().length > 0 ? code.trim() : null,
        quantity: sum,
        grouped: true,
      });
    }
  } else {
    for (const items of byKind.values()) {
      for (const r of items) {
        perManuRows.push({
          manufacturerName: r.manufacturerName,
          kind: r.kind,
          kindLabel: kindToFullLabel(r.kind, r.manufacturerName),
          code: r.code && r.code.trim().length > 0 ? r.code.trim() : null,
          quantity: r.quantity,
          grouped: false,
        });
      }
    }
  }

  groupedRows.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind));
  perManuRows.sort((a, b) => {
    const so =
      raw.find((r) => r.manufacturerName === a.manufacturerName)?.manufacturerSortOrder ?? 0;
    const sb =
      raw.find((r) => r.manufacturerName === b.manufacturerName)?.manufacturerSortOrder ?? 0;
    const d = so - sb;
    if (d !== 0) return d;
    const n = a.manufacturerName.localeCompare(b.manufacturerName, "hr");
    if (n !== 0) return n;
    return kindOrder(a.kind) - kindOrder(b.kind);
  });

  return [...groupedRows, ...perManuRows];
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

/**
 * Naziv bez manufacturer-a — koristi se kad je red zajednički preko više
 * proizvođača s istom šifrom.
 */
function kindToShortLabel(kind: ServiceLabelKind): string {
  switch (kind) {
    case "PERIODIC":
      return "Naljepnica periodičnog pregleda";
    case "APPARATUS_MASS":
      return "Naljepnica mase aparata";
    case "CYLINDER_MASS":
      return "Naljepnica mase bočice";
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
