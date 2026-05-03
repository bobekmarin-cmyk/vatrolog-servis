import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";
import { buildVariantSnapshot, type VariantSnapshot } from "./serviceVariant";

type AnyClient = PrismaClient | Prisma.TransactionClient;

/**
 * Osigurava da u `CompanyServiceCatalog` postoje redovi (PERIODIC + INTERNAL)
 * za svaku **varijantu** servisa (agent + construction + capacity +
 * capacityUnit; fallback po type.code) kod zadanih tvrtki.
 *
 * "Live tip" = ExtinguisherType s barem jednim ManufacturerExtinguisherType
 * link-om. Orphan tipovi (bez manufacturer linka) ne sudjeluju u sync-u.
 *
 * Različiti `ExtinguisherType` zapisi koji se svode na istu varijantu
 * (npr. P9 ST prah kod više proizvođača) dijele jedan red u katalogu —
 * tenant unosi šifru samo jednom po varijanti.
 *
 * Pruning:
 *  - full sync (bez `extinguisherTypeId`) briše sve `CompanyServiceCatalog`
 *    redove kod sync-anih tvrtki čiji `variantKey` više ne postoji u live
 *    setu varijanti.
 *  - per-type sync (s `extinguisherTypeId`) NE prune-a — to je add-only put
 *    nakon kreacije/edita pojedinog tipa, gdje je tip 100% live.
 *
 * Pozivaj s:
 *  - { extinguisherTypeId } → upserta varijantu tog tipa kod svih tvrtki
 *  - { companyId }          → upserta sve varijante kod te tvrtke + prune
 *  - { companyId, extinguisherTypeId } → upserta varijantu tog tipa kod te tvrtke
 *  - bez argumenata         → full sync (sve tvrtke × sve varijante) + prune
 *
 * Vraća broj NOVOKREIRANIH redova (prune brojanje je u logu, ne u return-u).
 */
export async function syncCompanyServiceCatalog(
  tx: AnyClient | null | undefined,
  args: { companyId?: string; extinguisherTypeId?: string } = {},
): Promise<number> {
  const client: AnyClient = tx ?? defaultPrisma;

  const companyIds: string[] = args.companyId
    ? [args.companyId]
    : (await client.company.findMany({ where: { deletedAt: null }, select: { id: true } })).map(
        (c) => c.id,
      );

  if (companyIds.length === 0) return 0;

  // Live filter: tip mora imati barem 1 manufacturer link da bi sudjelovao
  // u katalogu usluga. Ako je per-type sync, traženi tip MORA biti live —
  // u suprotnom radi se o pozivu nakon orphan brisanja, pa skip.
  const typeWhere: Prisma.ExtinguisherTypeWhereInput = args.extinguisherTypeId
    ? { id: args.extinguisherTypeId, manufacturers: { some: {} } }
    : { manufacturers: { some: {} } };

  const types = await client.extinguisherType.findMany({
    where: typeWhere,
    select: {
      id: true,
      code: true,
      agentId: true,
      constructionId: true,
      capacity: true,
      capacityUnit: true,
      construction: { select: { prefix: true } },
    },
  });

  // Live varijante (set za prune i map za upsert).
  const variantsByKey = new Map<string, VariantSnapshot>();
  for (const t of types) {
    const snap = buildVariantSnapshot({
      code: t.code,
      agentId: t.agentId,
      constructionId: t.constructionId,
      capacity: t.capacity,
      capacityUnit: t.capacityUnit,
      construction: t.construction,
    });
    if (!variantsByKey.has(snap.variantKey)) {
      variantsByKey.set(snap.variantKey, snap);
    }
  }

  // Za prune treba znati pun set live varijanti (preko svih live tipova),
  // bez obzira na `extinguisherTypeId` filter — inače bi per-type sync
  // mogao greškom obrisati redove drugih varijanti. Učitaj zaseban set kad
  // ćemo prune-ati (full sync), inače preskoči.
  const willPrune = !args.extinguisherTypeId;
  let allLiveVariantKeys: Set<string> | null = null;
  if (willPrune) {
    allLiveVariantKeys = new Set(variantsByKey.keys());
  }

  let created = 0;
  if (variantsByKey.size > 0) {
    const variants = [...variantsByKey.values()];
    const kinds: Array<"PERIODIC" | "INTERNAL"> = ["PERIODIC", "INTERNAL"];

    for (const companyId of companyIds) {
      for (const snap of variants) {
        for (const kind of kinds) {
          const res = await client.companyServiceCatalog.upsert({
            where: {
              companyId_variantKey_kind: {
                companyId,
                variantKey: snap.variantKey,
                kind,
              },
            },
            update: {
              agentId: snap.agentId,
              constructionId: snap.constructionId,
              capacity: snap.capacity,
              capacityUnit: snap.capacityUnit,
              fallbackLabel: snap.fallbackLabel,
            },
            create: {
              companyId,
              variantKey: snap.variantKey,
              kind,
              agentId: snap.agentId,
              constructionId: snap.constructionId,
              capacity: snap.capacity,
              capacityUnit: snap.capacityUnit,
              fallbackLabel: snap.fallbackLabel,
            },
            select: { id: true, createdAt: true, updatedAt: true },
          });
          if (res.createdAt.getTime() === res.updatedAt.getTime()) {
            created += 1;
          }
        }
      }
    }
  }

  // Prune: obriši stale redove kod sync-anih tvrtki čije varijante više
  // ne pripadaju nijednom live tipu.
  if (willPrune && allLiveVariantKeys) {
    const liveKeys = [...allLiveVariantKeys];
    for (const companyId of companyIds) {
      await client.companyServiceCatalog.deleteMany({
        where: {
          companyId,
          ...(liveKeys.length > 0 ? { variantKey: { notIn: liveKeys } } : {}),
        },
      });
    }
  }

  return created;
}
