import { prisma } from "@/lib/prisma";

export async function getAgentTypes(opts: { includeInactive?: boolean } = {}) {
  return prisma.agentType.findMany({
    where: opts.includeInactive ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function getConstructions(opts: { includeInactive?: boolean } = {}) {
  return prisma.construction.findMany({
    where: opts.includeInactive ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function getManufacturerWithCatalog(manufacturerId: string) {
  return prisma.manufacturer.findUnique({
    where: { id: manufacturerId },
    include: {
      supportedTypes: {
        include: {
          extinguisherType: {
            include: { agent: true, construction: true },
          },
        },
      },
      parts: {
        orderBy: [{ active: "desc" }, { code: "asc" }],
        include: {
          types: {
            include: {
              extinguisherType: {
                include: { agent: true, construction: true },
              },
            },
          },
        },
      },
    },
  });
}

/** Helpers to format label with symbol for selects. */
export function agentOptionLabel(a: { label: string; symbol?: string | null }): string {
  return a.symbol ? `${a.label} (${a.symbol})` : a.label;
}

export function constructionOptionLabel(c: { label: string; prefix?: string | null }): string {
  return c.prefix ? `${c.label} [${c.prefix}]` : c.label;
}
