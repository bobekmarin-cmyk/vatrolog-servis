import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import { isValidTenantUsername } from "@/lib/companyAccountNaming";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string; accountUserId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId, accountUserId } = await params;
  const body = (await req.json().catch(() => null)) as { username?: string } | null;
  const newUsername = (body?.username ?? "").trim().toLowerCase();

  if (!newUsername) {
    return NextResponse.json({ error: "Username je obavezan." }, { status: 400 });
  }
  if (!isValidTenantUsername(newUsername)) {
    return NextResponse.json(
      { error: "Username mora biti u obliku XX-slug (XX = 2 znamenke, slug = a-z0-9)." },
      { status: 400 },
    );
  }

  const account = await prisma.accountUser.findFirst({
    where: { id: accountUserId, companyId },
    select: { id: true, username: true, serviceLocationId: true },
  });
  if (!account) {
    return NextResponse.json({ error: "Račun nije pronađen." }, { status: 404 });
  }
  if (account.username === newUsername) {
    return NextResponse.json({ ok: true, username: newUsername });
  }

  const conflict = await prisma.accountUser.findUnique({
    where: { username: newUsername },
    select: { id: true, companyId: true },
  });
  if (conflict && conflict.id !== accountUserId) {
    return NextResponse.json(
      { error: "Username je već zauzet (drugi račun ili tvrtka)." },
      { status: 409 },
    );
  }

  await prisma.accountUser.update({
    where: { id: accountUserId },
    data: { username: newUsername },
  });

  const meta = extractAuditMeta(req);
  await logAudit({
    companyId,
    actorId: ps.platformUserId,
    actorType: "PLATFORM_USER",
    action: "platform.account.rename",
    entity: "AccountUser",
    entityId: accountUserId,
    meta: { from: account.username, to: newUsername, serviceLocationId: account.serviceLocationId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true, username: newUsername });
}
