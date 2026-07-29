import type { Prisma, PrismaClient } from "@prisma/client";
import { PartUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Prikaz mjerne jedinice dijela: KOM → "kom", KG → "kg", L → "L".
 * Koristi se u UI pickeru, otpremnici/PDF-u i tiskanim materijalima.
 */
export function formatPartUnit(unit: PartUnit | null | undefined): string {
  switch (unit) {
    case PartUnit.KG:
      return "kg";
    case PartUnit.L:
      return "L";
    case PartUnit.KOM:
    default:
      return "kom";
  }
}

/**
 * =====================================================================
 * Reserved Parts Catalogs — pravila prikaza, dostupnosti i snapshotiranja
 * =====================================================================
 *
 * Centralizirano mjesto za pravila kataloga rezervnih dijelova:
 *
 * - Platform dijelovi (Part.companyId IS NULL):
 *   - Vidljivi tenantu samo ako je za pripadajućeg proizvođača uključen
 *     `CompanyPartCatalogSetting.usePlatformCatalog` (default TRUE).
 *   - Tenant može preko `CompanyPartOverride` dodijeliti vlastitu (interno
 *     računovodstvenu) šifru, vlastitu cijenu, deaktivirati pojedini dio i
 *     overrideati „uobičajen“ (favorit za brzi izbornik) neovisno o
 *     platform defaultu `Part.common`.
 *   - Šifra proizvođača (`Part.manufacturerCode`) je read-only za tenanta.
 *   - Naziv (`Part.name`) i tipovi aparata su definirani na platform razini
 *     i nisu tenant-editabilni.
 *
 * - Vlastiti (tenant) dijelovi (Part.companyId = tenantId):
 *   - Tenant uvijek može uređivati šifru, naziv, cijenu, aktivaciju i tipove.
 *   - Brisanje je dozvoljeno samo ako dio nije korišten; inače deaktivacija.
 *
 * - Snapshot na servisima (`WorkOrderItemPart`):
 *   - Pri spremanju servisa snapshotiramo prikaznu šifru, šifru proizvođača,
 *     naziv i izvor dijela. Time povijesni servisi/otpremnice ostaju stabilni
 *     i nakon kasnijih izmjena u katalogu.
 */

export type PartSourceLabel = "PLATFORM" | "CUSTOM";

type Db =
  | PrismaClient
  | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Minimalni Part oblik koji nam treba za prikaz/snapshotiranje. */
export type PartLite = {
  id: string;
  manufacturerId: string;
  companyId: string | null;
  code: string;
  manufacturerCode: string | null;
  name: string;
  active: boolean;
  /** Opcionalno — potrebno samo za efektivni favorit / brzi izbornik. */
  common?: boolean;
  defaultPrice: Prisma.Decimal | null;
  unit: PartUnit;
};

export type PartOverrideLite = {
  partId: string;
  code: string | null;
  price: Prisma.Decimal | null;
  active: boolean;
  /** null = naslijedi Part.common */
  common: boolean | null;
};

/**
 * Vrati prikaznu šifru dijela:
 *  - vlastiti dio: uvijek `Part.code` (tenantov)
 *  - platform dio s overrideom i ne-praznom šifrom: override šifra
 *  - platform dio s `manufacturerCode`: ta šifra
 *  - platform dio bez šifre proizvođača: prazno (tehnički `code` ostaje u DB)
 */
export function partDisplayCode(part: PartLite, override?: PartOverrideLite | null): string {
  if (part.companyId) return part.code;
  const ov = override?.code?.trim();
  if (ov) return ov;
  const mc = part.manufacturerCode?.trim();
  if (mc) return mc;
  return "";
}

/**
 * Vrati šifru proizvođača (samo za platform dijelove). Za vlastite dijelove
 * vraća null jer ih proizvođač ne vodi pod svojim šiframa.
 * Ako `manufacturerCode` nije unesen, vraća null (ne pada na tehnički `code`).
 */
export function partManufacturerCode(part: PartLite): string | null {
  if (part.companyId) return null;
  const mc = part.manufacturerCode?.trim();
  return mc && mc.length > 0 ? mc : null;
}

/**
 * Efektivna jedinična cijena: tenant override > platform default.
 * Za vlastite dijelove uvijek `Part.defaultPrice`.
 */
export function partEffectivePrice(
  part: PartLite,
  override?: PartOverrideLite | null,
): Prisma.Decimal | null {
  if (!part.companyId && override?.price != null) return override.price;
  return part.defaultPrice ?? null;
}

/**
 * Da li je dio aktivan za tenant katalog (ne uzima u obzir `usePlatformCatalog`
 * toggle proizvođača — to validiraj odvojeno).
 *  - vlastiti: `Part.active`
 *  - platform: `Part.active && (override?.active ?? true)`
 */
export function partActiveForCompany(part: PartLite, override?: PartOverrideLite | null): boolean {
  if (!part.active) return false;
  if (part.companyId) return true;
  return override?.active ?? true;
}

/**
 * Efektivno „uobičajen“ (favorit) za brzi izbornik na upisniku:
 *  - vlastiti dio: `Part.common`
 *  - platform: `CompanyPartOverride.common` ako je postavljen, inače `Part.common`
 */
export function partEffectiveCommon(
  part: Pick<PartLite, "companyId" | "common">,
  override?: Pick<PartOverrideLite, "common"> | null,
): boolean {
  if (part.companyId) return part.common === true;
  if (override?.common != null) return override.common;
  return part.common === true;
}

/**
 * Vrati skup `manufacturerId` za koje tenant ima `usePlatformCatalog = true`.
 * Default je TRUE — ako zapis ne postoji, smatramo da je platform katalog
 * uključen.
 */
export async function getEnabledPlatformManufacturers(
  db: Db,
  params: { companyId: string; manufacturerIds?: string[] },
): Promise<Set<string>> {
  const settings = await (db as PrismaClient).companyPartCatalogSetting.findMany({
    where: {
      companyId: params.companyId,
      ...(params.manufacturerIds ? { manufacturerId: { in: params.manufacturerIds } } : {}),
    },
    select: { manufacturerId: true, usePlatformCatalog: true },
  });
  const explicit = new Map<string, boolean>();
  for (const s of settings) explicit.set(s.manufacturerId, s.usePlatformCatalog);

  if (params.manufacturerIds) {
    const out = new Set<string>();
    for (const mid of params.manufacturerIds) {
      const v = explicit.has(mid) ? explicit.get(mid)! : true;
      if (v) out.add(mid);
    }
    return out;
  }

  // Bez restrikcije proizvođača — vraćamo sve EXPLICITNO uključene.
  // Pozivatelj koji nema listu treba i dalje raditi default = TRUE per
  // proizvođač (preporučeno: uvijek poslati listu manufacturerIds).
  const out = new Set<string>();
  for (const [mid, on] of explicit) if (on) out.add(mid);
  return out;
}

/**
 * Vrati overrideove tenanta po `partId`.
 */
export async function getCompanyPartOverridesByPartIds(
  db: Db,
  params: { companyId: string; partIds: string[] },
): Promise<Map<string, PartOverrideLite>> {
  if (params.partIds.length === 0) return new Map();
  const rows = await (db as PrismaClient).companyPartOverride.findMany({
    where: { companyId: params.companyId, partId: { in: params.partIds } },
    select: { partId: true, code: true, price: true, active: true, common: true },
  });
  const out = new Map<string, PartOverrideLite>();
  for (const r of rows) out.set(r.partId, r);
  return out;
}

/**
 * Vrati listu dijelova dostupnih za odabir na servisu (picker).
 *
 * Uključuje:
 *  - vlastite (tenant) dijelove ako su `active = true`
 *  - platform dijelove ako:
 *      - `usePlatformCatalog` za pripadajućeg proizvođača je uključen
 *      - `Part.active = true`
 *      - tenant override `active != false`
 *
 * Filtri:
 *  - `manufacturerId` (obavezno — picker je vezan za aparat tog proizvođača)
 *  - `extinguisherTypeId` (opcionalno — filtrira po vrijedi-za-tip)
 *  - `common` (opcionalno — true = samo efektivno uobičajeni dijelovi
 *    nakon tenant overridea)
 *  - `seedPartIds` — uvijek uključi te id-jeve (npr. već odabrani dijelovi
 *    na servisu, čak i ako su u međuvremenu deaktivirani).
 */
export async function listAvailablePartsForCompany(
  db: Db,
  params: {
    companyId: string;
    manufacturerId: string;
    extinguisherTypeId?: string | null;
    common?: boolean;
    seedPartIds?: string[];
  },
): Promise<
  Array<{
    part: PartLite;
    override: PartOverrideLite | null;
    displayCode: string;
    manufacturerCode: string | null;
    isCustom: boolean;
    isCommon: boolean;
    available: boolean;
  }>
> {
  const enabled = await getEnabledPlatformManufacturers(db, {
    companyId: params.companyId,
    manufacturerIds: [params.manufacturerId],
  });
  const platformEnabled = enabled.has(params.manufacturerId);
  const seed = new Set(params.seedPartIds ?? []);

  const baseWhere: Prisma.PartWhereInput = {
    manufacturerId: params.manufacturerId,
    OR: [{ companyId: null }, { companyId: params.companyId }],
    ...(params.extinguisherTypeId
      ? { types: { some: { extinguisherTypeId: params.extinguisherTypeId } } }
      : {}),
  };

  const parts = await (db as PrismaClient).part.findMany({
    where: baseWhere,
    select: {
      id: true,
      manufacturerId: true,
      companyId: true,
      code: true,
      manufacturerCode: true,
      name: true,
      active: true,
      defaultPrice: true,
      unit: true,
      common: true,
    },
    orderBy: [{ active: "desc" }, { code: "asc" }, { name: "asc" }],
  });

  const overrides = await getCompanyPartOverridesByPartIds(db, {
    companyId: params.companyId,
    partIds: parts.map((p) => p.id),
  });

  return parts
    .map((p) => {
      const ov = overrides.get(p.id) ?? null;
      const isCustom = p.companyId !== null;
      const isCommon = partEffectiveCommon(p, ov);
      if (params.common && !isCommon && !seed.has(p.id)) return null;
      const inCatalog = isCustom || platformEnabled;
      const active = partActiveForCompany(p, ov);
      const available = inCatalog && active;
      const include = available || seed.has(p.id);
      if (!include) return null;
      return {
        part: p,
        override: ov,
        displayCode: partDisplayCode(p, ov),
        manufacturerCode: partManufacturerCode(p),
        isCustom,
        isCommon,
        available,
      };
    })
    .filter(<T>(x: T | null): x is T => x !== null);
}

/**
 * Vrati listu dijelova za prikaz u postavkama (admin → Rezervni dijelovi).
 * Uključuje sve dijelove (aktivne i neaktivne) — i vlastite i platform.
 */
export async function listSettingsPartsForCompany(
  db: Db,
  params: {
    companyId: string;
    manufacturerId?: string;
    onlyCustom?: boolean;
    onlyPlatform?: boolean;
  },
): Promise<
  Array<{
    part: PartLite & {
      types: Array<{ extinguisherTypeId: string }>;
    };
    override: PartOverrideLite | null;
    displayCode: string;
    manufacturerCode: string | null;
    isCustom: boolean;
    isCommon: boolean;
  }>
> {
  const sourceFilter: Prisma.PartWhereInput = params.onlyCustom
    ? { companyId: params.companyId }
    : params.onlyPlatform
    ? { companyId: null }
    : { OR: [{ companyId: null }, { companyId: params.companyId }] };

  const where: Prisma.PartWhereInput = {
    ...sourceFilter,
    ...(params.manufacturerId ? { manufacturerId: params.manufacturerId } : {}),
  };

  const parts = await (db as PrismaClient).part.findMany({
    where,
    select: {
      id: true,
      manufacturerId: true,
      companyId: true,
      code: true,
      manufacturerCode: true,
      name: true,
      active: true,
      common: true,
      defaultPrice: true,
      unit: true,
      types: { select: { extinguisherTypeId: true } },
    },
    orderBy: [{ companyId: "asc" }, { name: "asc" }, { code: "asc" }],
  });

  const overrides = await getCompanyPartOverridesByPartIds(db, {
    companyId: params.companyId,
    partIds: parts.map((p) => p.id),
  });

  return parts.map((p) => {
    const ov = overrides.get(p.id) ?? null;
    return {
      part: p,
      override: ov,
      displayCode: partDisplayCode(p, ov),
      manufacturerCode: partManufacturerCode(p),
      isCustom: p.companyId !== null,
      isCommon: partEffectiveCommon(p, ov),
    };
  });
}

/**
 * Snapshot polja koja se zapisuju na `WorkOrderItemPart` u trenutku ugradnje.
 * Centralizirano da se pravila ne dupliciraju u API-ju i recovery skriptama.
 */
export type WorkOrderPartSnapshot = {
  snapshotCode: string;
  snapshotManufacturerCode: string | null;
  snapshotName: string;
  snapshotIsCustom: boolean;
  snapshotUnit: PartUnit;
  unitPrice: Prisma.Decimal | null;
};

export function buildWorkOrderPartSnapshot(
  part: PartLite,
  override?: PartOverrideLite | null,
): WorkOrderPartSnapshot {
  return {
    snapshotCode: partDisplayCode(part, override),
    snapshotManufacturerCode: partManufacturerCode(part),
    snapshotName: part.name,
    snapshotIsCustom: part.companyId !== null,
    snapshotUnit: part.unit,
    unitPrice: partEffectivePrice(part, override),
  };
}

/**
 * Helper za prikaz na otpremnicama/upisniku/PDF-ovima: čita snapshot ako postoji,
 * inače fallback na živi `Part`. Time povijesni servisi ostaju vidljivi.
 */
export function readPartDisplayFromUsage(
  usage: {
    snapshotCode: string | null;
    snapshotManufacturerCode: string | null;
    snapshotName: string | null;
    snapshotIsCustom: boolean | null;
    snapshotUnit?: PartUnit | null;
  },
  part: PartLite | null | undefined,
  override?: PartOverrideLite | null,
): {
  code: string;
  manufacturerCode: string | null;
  name: string;
  isCustom: boolean;
  unit: PartUnit;
} {
  if (usage.snapshotCode || usage.snapshotName) {
    return {
      code: usage.snapshotCode ?? (part ? partDisplayCode(part, override) : ""),
      manufacturerCode:
        usage.snapshotManufacturerCode ?? (part ? partManufacturerCode(part) : null),
      name: usage.snapshotName ?? part?.name ?? "",
      isCustom: usage.snapshotIsCustom ?? (part?.companyId !== null && part?.companyId !== undefined),
      unit: usage.snapshotUnit ?? part?.unit ?? PartUnit.KOM,
    };
  }
  if (part) {
    return {
      code: partDisplayCode(part, override),
      manufacturerCode: partManufacturerCode(part),
      name: part.name,
      isCustom: part.companyId !== null,
      unit: part.unit,
    };
  }
  return { code: "—", manufacturerCode: null, name: "—", isCustom: false, unit: PartUnit.KOM };
}

/**
 * Mali wrapper kad nemamo Db handle u dosegu (npr. server pages).
 */
export const partsCatalog = {
  prisma: () => prisma,
  partDisplayCode,
  partManufacturerCode,
  partEffectivePrice,
  partEffectiveCommon,
  partActiveForCompany,
  buildWorkOrderPartSnapshot,
  readPartDisplayFromUsage,
  formatPartUnit,
};
