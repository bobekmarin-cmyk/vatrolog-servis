import { prisma } from "@/lib/prisma";

/**
 * Status Korisničkog portala za serviserov prikaz na kupcu.
 *
 * SIGURNOST / model: serviser poziva samo JEDNOG administratora tvrtke i NE vidi
 * popis korisničkih računa niti bilo kakve podatke drugih servisa. Daljnje račune
 * dodaje sam admin u portalu. Serviser ovdje vidi samo: je li portal aktivan i je
 * li njegova pozivnica administratoru još na čekanju.
 */

export type CustomerPortalStatus = {
  /** Vlasnik (po OIB-u) ima aktivnog administratora portala. */
  portalActive: boolean;
  /** Ovaj serviser ima pending pozivnicu administratoru za ovog kupca. */
  hasPendingInvite: boolean;
};

export async function getCustomerPortalStatus(
  oib: string | null,
  customerId: string,
): Promise<CustomerPortalStatus> {
  const org = oib ? await prisma.ownerOrg.findUnique({ where: { oib }, select: { id: true } }) : null;

  const [adminCount, pending] = await Promise.all([
    org
      ? prisma.ownerOrgMembership.count({ where: { ownerOrgId: org.id, status: "ACTIVE", role: "ADMIN" } })
      : Promise.resolve(0),
    prisma.authToken.count({
      where: {
        type: "OWNER_INVITE",
        usedAt: null,
        expiresAt: { gt: new Date() },
        meta: { path: ["customerId"], equals: customerId },
      },
    }),
  ]);

  return { portalActive: adminCount > 0, hasPendingInvite: pending > 0 };
}
