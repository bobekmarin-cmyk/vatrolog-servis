import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vendor sakriva / prikazuje servis u korisničkom portalu (ACTIVE veza).
 * Body: { hidden: boolean }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { linkId } = await params;
  const body = (await req.json().catch(() => ({}))) as { hidden?: boolean };
  const hidden = body.hidden === true;

  const link = await prisma.ownerCustomerLink.findUnique({
    where: { id: linkId },
    select: { id: true, companyId: true },
  });
  if (!link) return NextResponse.json({ error: "Veza ne postoji." }, { status: 404 });

  await prisma.ownerCustomerLink.update({
    where: { id: linkId },
    data: { hiddenByVendorAt: hidden ? new Date() : null },
  });

  await prisma.auditLog.create({
    data: {
      companyId: link.companyId,
      actorType: "PLATFORM",
      action: hidden ? "platform.owner.link.hide" : "platform.owner.link.show",
      entity: "OwnerCustomerLink",
      entityId: linkId,
      meta: { by: ps.platformUserId },
    },
  });

  return NextResponse.json({ ok: true, hidden });
}
