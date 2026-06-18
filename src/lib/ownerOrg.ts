import { prisma } from "@/lib/prisma";

/**
 * OwnerOrg = entitet vlasnika aparata (sidro po OIB-u). Više login računa
 * (`Owner`) može pripadati istom orgu i dijeli isti skup povezanih servisa.
 * Vidljivost u portalu računa se po `ownerOrgId`, ne po pojedinom loginu.
 */

/** Org kojem pripada login vlasnika (ili null ako još nije povezan). */
export async function resolveOwnerOrgId(ownerId: string): Promise<string | null> {
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    select: { ownerOrgId: true },
  });
  return owner?.ownerOrgId ?? null;
}

/** Upsert OwnerOrg po OIB-u; vraća id. */
export async function ensureOwnerOrgForOib(oib: string, name?: string | null): Promise<string> {
  const org = await prisma.ownerOrg.upsert({
    where: { oib },
    create: { oib, name: name ?? null },
    update: name ? { name } : {},
    select: { id: true },
  });
  return org.id;
}

/** Poveži login vlasnika s orgom ako još nije povezan. */
export async function attachOwnerToOrg(ownerId: string, ownerOrgId: string): Promise<void> {
  await prisma.owner.update({
    where: { id: ownerId },
    data: { ownerOrgId },
  });
}
