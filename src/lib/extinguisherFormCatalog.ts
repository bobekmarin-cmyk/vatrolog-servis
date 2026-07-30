import { prisma } from "@/lib/prisma";

export type ExtinguisherFormManufacturer = {
  id: string;
  name: string;
  supportedTypes: { extinguisherTypeId: string }[];
};

export type ExtinguisherFormType = {
  id: string;
  name: string;
  code: string;
  agent: { code: string; label: string; symbol: string | null } | null;
  construction: { code: string; label: string } | null;
};

export type ExtinguisherFormCatalog = {
  types: ExtinguisherFormType[];
  fillManufacturers: ExtinguisherFormManufacturer[];
  editManufacturers: ExtinguisherFormManufacturer[];
};

export type ExtinguisherEditInitial = {
  internalCode: string;
  manufacturerId: string;
  extinguisherTypeId: string;
  serialNumber: string;
  productionYear: number;
  typeDescription: string | null;
  serviceLocationText: string | null;
};

function mapManufacturer(m: {
  id: string;
  name: string;
  supportedTypes: { extinguisherTypeId: string }[];
}): ExtinguisherFormManufacturer {
  return {
    id: m.id,
    name: m.name,
    supportedTypes: m.supportedTypes.map((s) => ({
      extinguisherTypeId: s.extinguisherTypeId,
    })),
  };
}

type GlobalCatalog = {
  types: ExtinguisherFormType[];
  manufacturers: ExtinguisherFormManufacturer[];
};

/**
 * Tipovi aparata i veze proizvođač→tip su globalni katalog koji mijenja samo
 * platforma. Bez cachea se cijela `ManufacturerExtinguisherType` tablica
 * (proizvođači × tipovi, desetci tisuća redaka) čitala na svako otvaranje
 * radnog naloga. TTL je kratak da promjena u katalogu brzo dođe do tenanta.
 */
const GLOBAL_CATALOG_TTL_MS = 5 * 60 * 1000;
let globalCatalogCache: { at: number; value: GlobalCatalog } | null = null;

async function loadGlobalCatalog(): Promise<GlobalCatalog> {
  if (globalCatalogCache && Date.now() - globalCatalogCache.at < GLOBAL_CATALOG_TTL_MS) {
    return globalCatalogCache.value;
  }

  const [types, manufacturers] = await Promise.all([
    prisma.extinguisherType.findMany({
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        agent: { select: { code: true, label: true, symbol: true } },
        construction: { select: { code: true, label: true } },
      },
    }),
    prisma.manufacturer.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        supportedTypes: { select: { extinguisherTypeId: true } },
      },
    }),
  ]);

  const value: GlobalCatalog = {
    types: types.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      agent: t.agent
        ? {
            code: t.agent.code,
            label: t.agent.label,
            symbol: t.agent.symbol ?? null,
          }
        : null,
      construction: t.construction
        ? { code: t.construction.code, label: t.construction.label }
        : null,
    })),
    manufacturers: manufacturers.map(mapManufacturer),
  };

  globalCatalogCache = { at: Date.now(), value };
  return value;
}

/** Ručno poništavanje cachea nakon izmjene kataloga na platformi. */
export function invalidateExtinguisherFormCatalog(): void {
  globalCatalogCache = null;
}

/**
 * Katalog za drawer (proizvođači + tipovi). Učitava se jednom na stranici naloga
 * da se drawer otvara bez čekanja API-ja.
 */
export async function loadExtinguisherFormCatalog(
  companyId: string,
): Promise<ExtinguisherFormCatalog> {
  const [global, auth] = await Promise.all([
    loadGlobalCatalog(),
    prisma.companyManufacturerAuthorization.findMany({
      where: { companyId, active: true },
      select: { manufacturerId: true },
    }),
  ]);

  const authorized = new Set(auth.map((a) => a.manufacturerId));

  return {
    types: global.types,
    // `global.manufacturers` je već sortiran po sortOrder pa nazivu.
    fillManufacturers: global.manufacturers.filter((m) => authorized.has(m.id)),
    editManufacturers: global.manufacturers,
  };
}
