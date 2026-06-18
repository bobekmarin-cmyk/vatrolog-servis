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
  role: "ADMIN" | "MEMBER";
};

/** Aktivne tvrtke (OwnerOrg) kojima ovaj login smije pristupiti. */
export async function getOwnerMembershipOrgs(ownerId: string): Promise<OwnerMembershipOrg[]> {
  const memberships = await prisma.ownerOrgMembership.findMany({
    where: { ownerId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { role: true, ownerOrg: { select: { id: true, oib: true, name: true } } },
  });
  return memberships.map((m) => ({
    ownerOrgId: m.ownerOrg.id,
    oib: m.ownerOrg.oib,
    name: m.ownerOrg.name,
    role: m.role,
  }));
}

/** Je li ovaj login ADMIN u zadanoj tvrtki (smije upravljati računima). */
export async function isOwnerOrgAdmin(ownerId: string, ownerOrgId: string): Promise<boolean> {
  const m = await prisma.ownerOrgMembership.findFirst({
    where: { ownerId, ownerOrgId, status: "ACTIVE", role: "ADMIN" },
    select: { id: true },
  });
  return !!m;
}

export type OwnerOrgAccountRow = {
  ownerId: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "MEMBER";
  lastAccessAt: Date | null;
  isSelf: boolean;
};

export type OwnerOrgPendingRow = {
  email: string;
  role: "ADMIN" | "MEMBER";
  invitedAt: Date;
};

/** Aktivni računi + pending pozivnice za tvrtku (za admin prikaz u portalu). */
export async function getOwnerOrgAccounts(
  ownerOrgId: string,
  selfOwnerId: string,
): Promise<{ accounts: OwnerOrgAccountRow[]; pending: OwnerOrgPendingRow[] }> {
  const memberships = await prisma.ownerOrgMembership.findMany({
    where: { ownerOrgId, status: "ACTIVE" },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      ownerId: true,
      role: true,
      lastAccessAt: true,
      owner: { select: { email: true, name: true } },
    },
  });

  const accounts: OwnerOrgAccountRow[] = memberships.map((m) => ({
    ownerId: m.ownerId,
    email: m.owner.email,
    name: m.owner.name,
    role: m.role,
    lastAccessAt: m.lastAccessAt,
    isSelf: m.ownerId === selfOwnerId,
  }));

  const tokens = await prisma.authToken.findMany({
    where: {
      type: "OWNER_INVITE",
      usedAt: null,
      expiresAt: { gt: new Date() },
      meta: { path: ["ownerOrgId"], equals: ownerOrgId },
    },
    orderBy: { createdAt: "desc" },
    select: { email: true, createdAt: true, meta: true },
  });

  const activeEmails = new Set(accounts.map((a) => a.email.toLowerCase()));
  const seen = new Set<string>();
  const pending: OwnerOrgPendingRow[] = [];
  for (const t of tokens) {
    const email = (t.email ?? "").toLowerCase();
    if (!email || activeEmails.has(email) || seen.has(email)) continue;
    seen.add(email);
    const role = (t.meta as { role?: string } | null)?.role === "ADMIN" ? "ADMIN" : "MEMBER";
    pending.push({ email, role, invitedAt: t.createdAt });
  }

  return { accounts, pending };
}

/** Postoji li već aktivan admin za tvrtku (serviser tada ne poziva novog). */
export async function ownerOrgHasActiveAdmin(ownerOrgId: string): Promise<boolean> {
  const m = await prisma.ownerOrgMembership.findFirst({
    where: { ownerOrgId, status: "ACTIVE", role: "ADMIN" },
    select: { id: true },
  });
  return !!m;
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
  opts: {
    invitedEmail: string;
    invitedByAccountUserId?: string | null;
    invitedByCompanyId?: string | null;
    invitedByOwnerId?: string | null;
    role?: "ADMIN" | "MEMBER";
  },
): Promise<void> {
  // Prvi član tvrtke je uvijek ADMIN (inače poštuj proslijeđenu role).
  const hasAdmin = await ownerOrgHasActiveAdmin(ownerOrgId);
  const role: "ADMIN" | "MEMBER" = opts.role ?? (hasAdmin ? "MEMBER" : "ADMIN");

  await prisma.ownerOrgMembership.upsert({
    where: { ownerId_ownerOrgId: { ownerId, ownerOrgId } },
    create: {
      ownerId,
      ownerOrgId,
      status: "ACTIVE",
      role,
      invitedEmail: opts.invitedEmail,
      invitedByAccountUserId: opts.invitedByAccountUserId ?? null,
      invitedByCompanyId: opts.invitedByCompanyId ?? null,
      invitedByOwnerId: opts.invitedByOwnerId ?? null,
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
