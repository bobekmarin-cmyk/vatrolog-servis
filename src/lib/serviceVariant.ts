/**
 * Varijanta usluge — identificira jedinstven servis-slot po
 *   (agent, construction, capacity, capacityUnit).
 * Koristi se kao ključ u `CompanyServiceCatalog` tako da se isti fizički
 * tip aparata (npr. P9 STP prah) kod više proizvođača tretira kao jedna
 * stavka u katalogu usluga (korisnik upisuje šifru samo jednom).
 *
 * Kad construction.prefix ili capacity nedostaju (npr. nekonvencionalni
 * tipovi), koristi se fallback ključ s type.code.
 */

export type CapacityUnitValue = "KG" | "L";

export type VariantSnapshot = {
  /** Deterministički ključ koji se sprema u bazu. */
  variantKey: string;
  agentId: string;
  constructionId: string | null;
  capacity: number | null;
  capacityUnit: CapacityUnitValue | null;
  /** Postavljeno samo kad idemo u fallback granu (npr. "CO2-2"). */
  fallbackLabel: string | null;
};

type BuildInput = {
  code: string;
  agentId: string;
  constructionId?: string | null;
  capacity?: number | null;
  capacityUnit?: CapacityUnitValue | null;
  construction?: { prefix?: string | null } | null;
};

export function buildVariantSnapshot(type: BuildInput): VariantSnapshot {
  const prefix = type.construction?.prefix?.trim() ?? "";
  const capacity = type.capacity ?? null;
  const capacityUnit = type.capacityUnit ?? null;
  const constructionId = type.constructionId ?? null;
  const agentId = type.agentId;

  if (prefix && capacity != null && constructionId) {
    const unitPart = capacityUnit ?? "";
    return {
      variantKey: `v1|${agentId}|${constructionId}|${capacity}|${unitPart}`,
      agentId,
      constructionId,
      capacity,
      capacityUnit,
      fallbackLabel: null,
    };
  }

  return {
    variantKey: `v1c|${agentId}|${type.code}`,
    agentId,
    constructionId: null,
    capacity: null,
    capacityUnit: null,
    fallbackLabel: type.code,
  };
}

/** Konveniencija: vrati samo ključ. */
export function serviceVariantKey(type: BuildInput): string {
  return buildVariantSnapshot(type).variantKey;
}
