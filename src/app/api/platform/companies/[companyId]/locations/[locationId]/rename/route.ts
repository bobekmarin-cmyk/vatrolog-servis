import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string; locationId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId, locationId } = await params;
  const body = (await req.json().catch(() => null)) as { label?: string } | null;
  const newLabel = (body?.label ?? "").trim();

  if (!newLabel) {
    return NextResponse.json({ error: "Labela je obavezna." }, { status: 400 });
  }
  if (newLabel.length > 60) {
    return NextResponse.json({ error: "Labela može imati najviše 60 znakova." }, { status: 400 });
  }

  const location = await prisma.companyServiceLocation.findFirst({
    where: { id: locationId, companyId },
    select: { id: true, label: true, kind: true, ordinal: true },
  });
  if (!location) {
    return NextResponse.json({ error: "Lokacija nije pronađena." }, { status: 404 });
  }
  if (location.label === newLabel) {
    return NextResponse.json({ ok: true, label: newLabel });
  }

  await prisma.companyServiceLocation.update({
    where: { id: locationId },
    data: { label: newLabel },
  });

  const meta = extractAuditMeta(req);
  await logAudit({
    companyId,
    actorId: ps.platformUserId,
    actorType: "PLATFORM_USER",
    action: "platform.location.rename",
    entity: "CompanyServiceLocation",
    entityId: locationId,
    meta: {
      from: location.label,
      to: newLabel,
      kind: location.kind,
      ordinal: location.ordinal,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true, label: newLabel });
}
