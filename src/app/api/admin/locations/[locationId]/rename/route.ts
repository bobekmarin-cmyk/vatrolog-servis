import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";

/**
 * Tenant admin preimenuje labelu vlastite servisne lokacije
 * (npr. "Stacionarni servis 2" → "Skladište NM" radi kraćeg prikaza
 * na gumbima u radnom nalogu).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }
  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Samo admin tvrtke može mijenjati labele lokacija." },
      { status: 403 },
    );
  }

  const { locationId } = await params;
  const body = (await req.json().catch(() => null)) as { label?: string } | null;
  const newLabel = (body?.label ?? "").trim();

  if (!newLabel) {
    return NextResponse.json({ error: "Labela je obavezna." }, { status: 400 });
  }
  if (newLabel.length > 60) {
    return NextResponse.json({ error: "Labela može imati najviše 60 znakova." }, { status: 400 });
  }

  const location = await prisma.companyServiceLocation.findFirst({
    where: { id: locationId, companyId: session.companyId },
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
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "admin.location.rename",
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
