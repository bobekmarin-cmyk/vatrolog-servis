import { prisma } from "@/lib/prisma";

/**
 * Računi Korisničkog portala su na razini vlasnika (OwnerOrg, po OIB-u), ne po
 * pojedinom servisu. Zato su e-mailovi računa vidljivi svim servisima koji
 * servisiraju tog vlasnika (da se ne dupliciraju pozivnice).
 *
 * SIGURNOST: serviser NIKAD ne smije saznati IDENTITET drugog servisera niti
 * vidjeti njegove podatke. Zato atribucija otkriva samo "je li račun pozvao
 * upravo ovaj serviser" (boolean) — nikad ime/podatke drugog servisa. Aparati,
 * nalozi, primke, upisnici i otpremnice drugih servisa nisu ovdje dostupni.
 */

export type PortalAccount = {
  ownerId: string;
  email: string;
  name: string | null;
  lastAccessAt: Date | null;
  invitedByThisCompany: boolean;
};

export type PortalPendingInvite = {
  email: string;
  invitedAt: Date;
  invitedByThisCompany: boolean;
};

export type CustomerPortalAccounts = {
  ownerOrgId: string | null;
  accounts: PortalAccount[];
  pendingInvites: PortalPendingInvite[];
};

export async function getCustomerPortalAccounts(
  oib: string | null,
  customerId: string,
  currentCompanyId: string,
): Promise<CustomerPortalAccounts> {
  const org = oib ? await prisma.ownerOrg.findUnique({ where: { oib }, select: { id: true } }) : null;
  const ownerOrgId = org?.id ?? null;

  const [memberships, tokens] = await Promise.all([
    ownerOrgId
      ? prisma.ownerOrgMembership.findMany({
          where: { ownerOrgId, status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          select: {
            ownerId: true,
            invitedByCompanyId: true,
            lastAccessAt: true,
            owner: { select: { email: true, name: true, lastLoginAt: true } },
          },
        })
      : Promise.resolve([]),
    prisma.authToken.findMany({
      where: {
        type: "OWNER_INVITE",
        usedAt: null,
        expiresAt: { gt: new Date() },
        OR: [
          ...(ownerOrgId ? [{ meta: { path: ["ownerOrgId"], equals: ownerOrgId } }] : []),
          { meta: { path: ["customerId"], equals: customerId } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { email: true, companyId: true, createdAt: true },
    }),
  ]);

  const activeEmails = new Set(memberships.map((m) => m.owner.email.toLowerCase()));

  const accounts: PortalAccount[] = memberships.map((m) => ({
    ownerId: m.ownerId,
    email: m.owner.email,
    name: m.owner.name,
    lastAccessAt: m.lastAccessAt ?? m.owner.lastLoginAt ?? null,
    // Nikad ne otkrivamo IME drugog servisa — samo je li račun pozvao ovaj serviser.
    invitedByThisCompany: m.invitedByCompanyId === currentCompanyId,
  }));

  // Pending invitee koji još nemaju aktivan račun (dedupe po e-mailu).
  const seen = new Set<string>();
  const pendingInvites: PortalPendingInvite[] = [];
  for (const t of tokens) {
    const e = t.email?.toLowerCase();
    if (!e || activeEmails.has(e) || seen.has(e)) continue;
    seen.add(e);
    pendingInvites.push({
      email: t.email!,
      invitedAt: t.createdAt,
      invitedByThisCompany: t.companyId === currentCompanyId,
    });
  }

  return { ownerOrgId, accounts, pendingInvites };
}
