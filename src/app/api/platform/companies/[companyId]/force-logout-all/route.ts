import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { redirectRelative } from "@/lib/httpRedirect";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { extractAuditMeta } from "@/lib/auditLog";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const rl = await checkRateLimit("platformWrite", clientKeyFromRequest(req), {
    limit: 10,
    windowSec: 60,
  });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previse zahtjeva. Pokusaj za ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const { companyId } = await params;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Tvrtka nije pronadena." }, { status: 404 });
  }

  const cutoff = new Date();
  const updated = await prisma.accountUser.updateMany({
    where: { companyId },
    data: { sessionsValidAfter: cutoff, currentSessionId: null },
  });

  const meta = extractAuditMeta(req);
  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.account.force-logout-all",
      entity: "Company",
      entityId: companyId,
      meta: {
        companyName: company.name,
        affectedAccounts: updated.count,
        cutoff: cutoff.toISOString(),
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, affected: updated.count, cutoff: cutoff.toISOString() });
  }
  return redirectRelative(`/platform/companies/${companyId}?tab=danger&forceLogoutAll=ok`, 303);
}
