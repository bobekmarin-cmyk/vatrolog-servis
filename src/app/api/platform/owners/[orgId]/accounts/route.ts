import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vendor upravlja korisničkim računima vlasnika (OwnerOrg).
 * Body: { action: "revoke" | "setRole", ownerId: string, role?: "ADMIN" | "MEMBER" }
 */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { orgId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    ownerId?: string;
    role?: "ADMIN" | "MEMBER";
  };
  const ownerId = String(body.ownerId ?? "");
  if (!ownerId) return NextResponse.json({ error: "Nedostaje račun." }, { status: 400 });

  const membership = await prisma.ownerOrgMembership.findUnique({
    where: { ownerId_ownerOrgId: { ownerId, ownerOrgId: orgId } },
    select: { id: true, role: true, status: true },
  });
  if (!membership) return NextResponse.json({ error: "Račun nije član ove tvrtke." }, { status: 404 });

  if (body.action === "setRole") {
    const role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
    if (membership.role === "ADMIN" && role === "MEMBER") {
      const admins = await prisma.ownerOrgMembership.count({
        where: { ownerOrgId: orgId, status: "ACTIVE", role: "ADMIN" },
      });
      if (admins <= 1) {
        return NextResponse.json({ error: "Tvrtka mora imati barem jednog administratora." }, { status: 400 });
      }
    }
    await prisma.ownerOrgMembership.update({ where: { id: membership.id }, data: { role } });
    await prisma.auditLog.create({
      data: {
        actorType: "PLATFORM",
        action: "platform.owner.account.setRole",
        entity: "OwnerOrg",
        entityId: orgId,
        meta: { by: ps.platformUserId, ownerId, role },
      },
    });
    return NextResponse.json({ ok: true });
  }

  // default: revoke
  await prisma.ownerOrgMembership.update({
    where: { id: membership.id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "PLATFORM",
      action: "platform.owner.account.revoke",
      entity: "OwnerOrg",
      entityId: orgId,
      meta: { by: ps.platformUserId, ownerId },
    },
  });
  return NextResponse.json({ ok: true });
}
