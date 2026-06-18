import { prisma } from "@/lib/prisma";
import { resolveOwnerOrgId } from "@/lib/ownerOrg";

/**
 * "Moji servisi" — popis svih servisera koji servisiraju aparate ovog vlasnika
 * (otkriveno po OIB-u kroz sve tvrtke), s brojem aparata i statusom u portalu.
 * Privatnost: ovo je vlasnikov vlastiti podatak (njegov OIB), pa smije vidjeti
 * sve svoje servisere — uključujući one koje još nije povezao.
 */

export type OwnerServicerStatus = "ACTIVE" | "REQUESTED" | "INVITED" | "NONE" | "OTHER";

export type OwnerServicer = {
  companyId: string;
  companyName: string;
  apparatusCount: number;
  status: OwnerServicerStatus;
  /** Kupac na koji vlasnik može poslati zahtjev za pristup (ako je status NONE). */
  requestCustomerId: string | null;
};

/** OIB-i vlasnika — OIB OwnerOrg-a + OIB-i kupaca s ACTIVE vezom u tom orgu. */
export async function getOwnerOibs(ownerId: string): Promise<string[]> {
  const ownerOrgId = await resolveOwnerOrgId(ownerId);
  if (!ownerOrgId) return [];
  const [org, links] = await Promise.all([
    prisma.ownerOrg.findUnique({ where: { id: ownerOrgId }, select: { oib: true } }),
    prisma.ownerCustomerLink.findMany({
      where: { ownerOrgId, status: "ACTIVE" },
      select: { customer: { select: { oib: true } } },
    }),
  ]);
  const oibs = links.map((l) => l.customer.oib).filter((o): o is string => !!o);
  if (org?.oib) oibs.push(org.oib);
  return [...new Set(oibs)];
}

async function distinctExtinguisherCount(customerId: string): Promise<number> {
  const rows = await prisma.workOrderItem.findMany({
    where: { workOrder: { customerId }, extinguisherId: { not: null } },
    select: { extinguisherId: true },
    distinct: ["extinguisherId"],
  });
  return rows.length;
}

const STATUS_RANK: Record<OwnerServicerStatus, number> = {
  ACTIVE: 5,
  REQUESTED: 4,
  INVITED: 3,
  NONE: 2,
  OTHER: 1,
};

export async function getOwnerServicers(ownerId: string): Promise<OwnerServicer[]> {
  const ownerOrgId = await resolveOwnerOrgId(ownerId);
  const oibs = await getOwnerOibs(ownerId);
  if (!ownerOrgId || oibs.length === 0) return [];

  const customers = await prisma.customer.findMany({
    where: { oib: { in: oibs }, deletedAt: null },
    select: {
      id: true,
      companyId: true,
      company: { select: { name: true } },
      ownerLink: { select: { ownerOrgId: true, status: true } },
    },
  });

  type Agg = {
    companyId: string;
    companyName: string;
    apparatusCount: number;
    status: OwnerServicerStatus;
    requestCustomerId: string | null;
  };
  const byCompany = new Map<string, Agg>();

  for (const c of customers) {
    let st: OwnerServicerStatus = "NONE";
    const link = c.ownerLink;
    if (link) {
      if (link.ownerOrgId === ownerOrgId) {
        st =
          link.status === "ACTIVE"
            ? "ACTIVE"
            : link.status === "REQUESTED"
              ? "REQUESTED"
              : link.status === "PENDING_INVITE"
                ? "INVITED"
                : "NONE";
      } else if (link.ownerOrgId && link.status === "ACTIVE") {
        st = "OTHER";
      }
    }

    const count = await distinctExtinguisherCount(c.id);

    const prev = byCompany.get(c.companyId);
    if (!prev) {
      byCompany.set(c.companyId, {
        companyId: c.companyId,
        companyName: c.company.name,
        apparatusCount: count,
        status: st,
        requestCustomerId: st === "NONE" ? c.id : null,
      });
    } else {
      prev.apparatusCount += count;
      if (STATUS_RANK[st] > STATUS_RANK[prev.status]) prev.status = st;
      if (!prev.requestCustomerId && st === "NONE") prev.requestCustomerId = c.id;
    }
  }

  return [...byCompany.values()].sort((a, b) => a.companyName.localeCompare(b.companyName, "hr"));
}

/**
 * Provjeri smije li vlasnik zatražiti pristup ovom kupcu: kupac mora dijeliti
 * OIB s vlasnikovim aktivnim vezama, i ne smije već biti aktivno povezan s
 * drugim računom.
 */
export async function ownerCanRequestCustomer(
  ownerId: string,
  customerId: string,
): Promise<{ companyId: string; customerName: string } | { error: string }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      shortName: true,
      oib: true,
      companyId: true,
      ownerLink: { select: { ownerOrgId: true, status: true } },
    },
  });
  if (!customer || !customer.oib) return { error: "Kupac ne postoji." };

  const ownerOrgId = await resolveOwnerOrgId(ownerId);
  const oibs = await getOwnerOibs(ownerId);
  if (!ownerOrgId || !oibs.includes(customer.oib)) {
    return { error: "Nemate pravo zatražiti pristup ovom servisu." };
  }

  const link = customer.ownerLink;
  if (link && link.ownerOrgId && link.ownerOrgId !== ownerOrgId && link.status === "ACTIVE") {
    return { error: "Aparati ovog servisa već su povezani s drugim računom." };
  }

  return { companyId: customer.companyId, customerName: customer.shortName ?? customer.name };
}
