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
    select: { id: true, name: true, deletedAt: true, blocked: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Tvrtka nije pronadena." }, { status: 404 });
  }
  if (company.deletedAt) {
    return NextResponse.json(
      { error: "Tvrtka je vec soft-deletana." },
      { status: 409 },
    );
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.company.update({
      where: { id: company.id },
      data: { deletedAt: now, blocked: true },
    }),
    // Force-logout svih u istom potezu da spreci pristup tijekom delete-a
    prisma.accountUser.updateMany({
      where: { companyId },
      data: { sessionsValidAfter: now, currentSessionId: null },
    }),
  ]);

  const meta = extractAuditMeta(req);
  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.company.softDelete",
      entity: "Company",
      entityId: companyId,
      meta: {
        companyName: company.name,
        wasBlocked: company.blocked,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, deletedAt: now.toISOString() });
  }
  return redirectRelative(`/platform/companies/${companyId}?tab=danger`, 303);
}
