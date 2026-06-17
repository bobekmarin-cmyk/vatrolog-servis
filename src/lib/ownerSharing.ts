import { prisma } from "@/lib/prisma";

/**
 * Cross-serviser dijeljenje: detekcija postojećeg Owner računa po OIB-u.
 *
 * Privatnost: namjerno NE otkrivamo koji je drugi serviser aktivirao portal —
 * samo da postoji aktivan račun za taj OIB. Serviser sam odlučuje hoće li
 * podijeliti svoje aparate (njegova privola za prikaz vlastitih podataka).
 */

export type ExistingPortalOwner = { ownerId: string; ownerEmail: string };

export async function findExistingPortalOwnerByOib(
  oib: string,
  excludeCompanyId: string,
): Promise<ExistingPortalOwner | null> {
  const link = await prisma.ownerCustomerLink.findFirst({
    where: {
      status: "ACTIVE",
      ownerId: { not: null },
      companyId: { not: excludeCompanyId },
      customer: { oib },
    },
    select: { ownerId: true, owner: { select: { email: true } } },
    orderBy: { acceptedAt: "asc" },
  });
  if (!link?.ownerId || !link.owner) return null;
  return { ownerId: link.ownerId, ownerEmail: link.owner.email };
}
