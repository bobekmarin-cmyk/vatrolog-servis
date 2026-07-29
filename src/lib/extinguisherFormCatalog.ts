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

/**
 * Katalog za drawer (proizvođači + tipovi). Učitava se jednom na stranici naloga
 * da se drawer otvara bez čekanja API-ja.
 */
export async function loadExtinguisherFormCatalog(
  companyId: string,
): Promise<ExtinguisherFormCatalog> {
  const [types, fillAuth, editManufacturers] = await Promise.all([
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
    prisma.companyManufacturerAuthorization.findMany({
      where: { companyId, active: true },
      include: {
        manufacturer: {
          include: { supportedTypes: { select: { extinguisherTypeId: true } } },
        },
      },
    }),
    prisma.manufacturer.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { supportedTypes: { select: { extinguisherTypeId: true } } },
    }),
  ]);

  const fillManufacturers = fillAuth
    .map((a) => a.manufacturer)
    .sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return a.name.localeCompare(b.name, "hr");
    })
    .map(mapManufacturer);

  return {
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
    fillManufacturers,
    editManufacturers: editManufacturers.map(mapManufacturer),
  };
}
