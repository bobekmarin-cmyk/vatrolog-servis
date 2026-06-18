import { prisma } from "@/lib/prisma";

/**
 * Vendor (platform) pregled vlasnika (OwnerOrg) i njihovih korisničkih portala.
 * Grupirano po OIB-u; vendor vidi račune, servisere i može upravljati vidljivošću.
 */

export type OwnerOrgRow = {
  id: string;
  oib: string;
  name: string | null;
  accountCount: number;
  verifiedAccountCount: number;
  activeServicerCount: number;
  totalServicerCount: number;
  portalActive: boolean;
};

export async function listOwnerOrgs(): Promise<OwnerOrgRow[]> {
  const orgs = await prisma.ownerOrg.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      oib: true,
      name: true,
      memberships: {
        where: { status: "ACTIVE" },
        select: { owner: { select: { emailVerifiedAt: true, passwordHash: true } } },
      },
      links: { select: { status: true, companyId: true } },
    },
  });

  return orgs.map((o) => {
    const verified = o.memberships.filter((m) => m.owner.emailVerifiedAt && m.owner.passwordHash).length;
    const activeCompanies = new Set(o.links.filter((l) => l.status === "ACTIVE").map((l) => l.companyId));
    const allCompanies = new Set(o.links.map((l) => l.companyId));
    return {
      id: o.id,
      oib: o.oib,
      name: o.name,
      accountCount: o.memberships.length,
      verifiedAccountCount: verified,
      activeServicerCount: activeCompanies.size,
      totalServicerCount: allCompanies.size,
      portalActive: verified > 0,
    };
  });
}

export type OwnerOrgAccount = {
  id: string;
  email: string;
  name: string | null;
  verified: boolean;
  hasPassword: boolean;
  lastLoginAt: Date | null;
  lastAccessAt: Date | null;
};

export type OwnerOrgServicer = {
  customerId: string;
  customerName: string;
  companyId: string;
  companyName: string;
  apparatusCount: number;
  linkId: string | null;
  status: "ACTIVE" | "REQUESTED" | "PENDING_INVITE" | "DECLINED" | "REVOKED" | "NONE";
  hidden: boolean;
  forced: boolean;
  linkedToOtherOrg: boolean;
};

export type OwnerOrgDetail = {
  id: string;
  oib: string;
  name: string | null;
  accounts: OwnerOrgAccount[];
  servicers: OwnerOrgServicer[];
};

async function distinctExtinguisherCount(customerId: string): Promise<number> {
  const rows = await prisma.workOrderItem.findMany({
    where: { workOrder: { customerId }, extinguisherId: { not: null } },
    select: { extinguisherId: true },
    distinct: ["extinguisherId"],
  });
  return rows.length;
}

export async function getOwnerOrgDetail(orgId: string): Promise<OwnerOrgDetail | null> {
  const org = await prisma.ownerOrg.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      oib: true,
      name: true,
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: {
          lastAccessAt: true,
          owner: {
            select: { id: true, email: true, name: true, emailVerifiedAt: true, passwordHash: true, lastLoginAt: true },
          },
        },
      },
    },
  });
  if (!org) return null;

  const customers = await prisma.customer.findMany({
    where: { oib: org.oib, deletedAt: null },
    orderBy: { company: { name: "asc" } },
    select: {
      id: true,
      name: true,
      shortName: true,
      companyId: true,
      company: { select: { name: true } },
      ownerLink: {
        select: { id: true, ownerOrgId: true, status: true, hiddenByVendorAt: true, forcedByVendorAt: true },
      },
    },
  });

  const servicers: OwnerOrgServicer[] = [];
  for (const c of customers) {
    const link = c.ownerLink;
    const belongs = !!link && link.ownerOrgId === org.id;
    servicers.push({
      customerId: c.id,
      customerName: c.shortName ?? c.name,
      companyId: c.companyId,
      companyName: c.company.name,
      apparatusCount: await distinctExtinguisherCount(c.id),
      linkId: belongs ? link!.id : null,
      status: belongs ? link!.status : "NONE",
      hidden: belongs ? !!link!.hiddenByVendorAt : false,
      forced: belongs ? !!link!.forcedByVendorAt : false,
      linkedToOtherOrg: !!link && !!link.ownerOrgId && link.ownerOrgId !== org.id,
    });
  }

  return {
    id: org.id,
    oib: org.oib,
    name: org.name,
    accounts: org.memberships.map((m) => ({
      id: m.owner.id,
      email: m.owner.email,
      name: m.owner.name,
      verified: !!m.owner.emailVerifiedAt,
      hasPassword: !!m.owner.passwordHash,
      lastLoginAt: m.owner.lastLoginAt,
      lastAccessAt: m.lastAccessAt,
    })),
    servicers,
  };
}
