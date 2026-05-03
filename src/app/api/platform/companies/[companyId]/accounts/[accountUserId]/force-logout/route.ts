import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string; accountUserId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { companyId, accountUserId } = await params;

  const account = await prisma.accountUser.findFirst({
    where: { id: accountUserId, companyId },
    select: { id: true, username: true, role: true },
  });
  if (!account) return NextResponse.json({ error: "Korisnički račun nije pronađen." }, { status: 404 });

  const cutoff = new Date();
  await prisma.accountUser.update({
    where: { id: account.id },
    data: { sessionsValidAfter: cutoff, currentSessionId: null },
  });

  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.account.force-logout",
      entity: "AccountUser",
      entityId: account.id,
      meta: {
        username: account.username,
        role: account.role,
        cutoff: cutoff.toISOString(),
      },
    },
  });

  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, cutoff: cutoff.toISOString() });
  }
  return NextResponse.redirect(new URL(`/platform/companies/${companyId}?forceLogout=ok`, req.url), 303);
}
