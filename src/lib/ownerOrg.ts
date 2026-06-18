import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { OWNER_ORG_COOKIE } from "@/lib/ownerAuth";

/**
 * OwnerOrg = entitet vlasnika aparata (sidro po OIB-u). Jedan login (`Owner`)
 * može imati pristup više OwnerOrg-ova preko `OwnerOrgMembership` (više tvrtki),
 * a jedna tvrtka može imati više računa. Aktivni subjekt bira se nakon prijave
 * i drži u cookieju (`vb_owner_org`).
 */

export type OwnerMembershipOrg = {
  ownerOrgId: string;
  oib: string;
  name: string | null;
};

/** Aktivne tvrtke (OwnerOrg) kojima ovaj login smije pristupiti. */
export async function getOwnerMembershipOrgs(ownerId: string): Promise<OwnerMembershipOrg[]> {
  const memberships = await prisma.ownerOrgMembership.findMany({
    where: { ownerId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { ownerOrg: { select: { id: true, oib: true, name: true } } },
  });
  return memberships.map((m) => ({
    ownerOrgId: m.ownerOrg.id,
    oib: m.ownerOrg.oib,
    name: m.ownerOrg.name,
  }));
}

/**
 * Aktivni subjekt (OwnerOrg) za prijavljenog vlasnika:
 * - iz cookieja ako je važeći (postoji ACTIVE membership),
 * - ako ima točno jednu tvrtku → ta tvrtka (nema potrebe za odabirom),
 * - inače null (treba odabir).
 */
export async function getActiveOwnerOrgId(ownerId: string): Promise<string | null> {
  const orgs = await getOwnerMembershipOrgs(ownerId);
  if (orgs.length === 0) return null;

  const cookieStore = await cookies();
  const cookieOrg = cookieStore.get(OWNER_ORG_COOKIE)?.value;
  if (cookieOrg && orgs.some((o) => o.ownerOrgId === cookieOrg)) return cookieOrg;

  if (orgs.length === 1) return orgs[0].ownerOrgId;
  return null;
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

/** Kreiraj/aktiviraj membership (login ↔ tvrtka). */
export async function ensureMembership(
  ownerId: string,
  ownerOrgId: string,
  opts: { invitedEmail: string; invitedByAccountUserId?: string | null; invitedByCompanyId?: string | null },
): Promise<void> {
  await prisma.ownerOrgMembership.upsert({
    where: { ownerId_ownerOrgId: { ownerId, ownerOrgId } },
    create: {
      ownerId,
      ownerOrgId,
      status: "ACTIVE",
      invitedEmail: opts.invitedEmail,
      invitedByAccountUserId: opts.invitedByAccountUserId ?? null,
      invitedByCompanyId: opts.invitedByCompanyId ?? null,
      acceptedAt: new Date(),
    },
    update: {
      status: "ACTIVE",
      acceptedAt: new Date(),
      revokedAt: null,
    },
  });
}

/** Zabilježi zadnji pristup tvrtki. */
export async function touchMembershipAccess(ownerId: string, ownerOrgId: string): Promise<void> {
  await prisma.ownerOrgMembership.updateMany({
    where: { ownerId, ownerOrgId, status: "ACTIVE" },
    data: { lastAccessAt: new Date() },
  });
}
