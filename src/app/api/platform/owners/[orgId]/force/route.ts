import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vendor prisilno aktivira servis za vlasnika (override privole servisera).
 * Kupac (servis) mora dijeliti OIB s OwnerOrg-om. Body: { customerId: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { orgId } = await params;
  const body = (await req.json().catch(() => ({}))) as { customerId?: string };
  const customerId = String(body.customerId ?? "");
  if (!customerId) return NextResponse.json({ error: "Nedostaje kupac." }, { status: 400 });

  const org = await prisma.ownerOrg.findUnique({ where: { id: orgId }, select: { oib: true } });
  if (!org) return NextResponse.json({ error: "Vlasnik ne postoji." }, { status: 404 });

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, oib: true, companyId: true, email: true },
  });
  if (!customer || customer.oib !== org.oib) {
    return NextResponse.json({ error: "Kupac ne pripada ovom vlasniku (OIB)." }, { status: 400 });
  }

  const primaryOwner = await prisma.owner.findFirst({
    where: { ownerOrgId: orgId },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  await prisma.ownerCustomerLink.upsert({
    where: { customerId },
    create: {
      companyId: customer.companyId,
      customerId,
      ownerOrgId: orgId,
      ownerId: primaryOwner?.id ?? null,
      invitedEmail: primaryOwner?.email ?? customer.email ?? "",
      status: "ACTIVE",
      acceptedAt: new Date(),
      forcedByVendorAt: new Date(),
      hiddenByVendorAt: null,
    },
    update: {
      ownerOrgId: orgId,
      status: "ACTIVE",
      acceptedAt: new Date(),
      forcedByVendorAt: new Date(),
      hiddenByVendorAt: null,
      revokedAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: customer.companyId,
      actorType: "PLATFORM",
      action: "platform.owner.servicer.force",
      entity: "Customer",
      entityId: customerId,
      meta: { by: ps.platformUserId, orgId },
    },
  });

  return NextResponse.json({ ok: true, status: "ACTIVE" });
}
