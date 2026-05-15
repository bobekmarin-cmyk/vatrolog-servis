import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { redirectRelative } from "@/lib/httpRedirect";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { extractAuditMeta } from "@/lib/auditLog";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string; extinguisherId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const rl = await checkRateLimit("platformWrite", clientKeyFromRequest(req), {
    limit: 60,
    windowSec: 60,
  });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previse zahtjeva. Pokusaj za ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const { companyId, extinguisherId } = await params;

  const ext = await prisma.extinguisher.findFirst({
    where: { id: extinguisherId, companyId },
    select: {
      id: true,
      internalCode: true,
      serialNumber: true,
      status: true,
      deletedAt: true,
    },
  });
  if (!ext) {
    return NextResponse.json({ error: "Aparat nije pronaden." }, { status: 404 });
  }
  if (ext.deletedAt) {
    return NextResponse.json(
      { error: "Aparat je vec soft-deletan." },
      { status: 409 },
    );
  }

  const now = new Date();
  await prisma.extinguisher.update({
    where: { id: ext.id },
    data: { deletedAt: now },
  });

  const meta = extractAuditMeta(req);
  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.extinguisher.softDelete",
      entity: "Extinguisher",
      entityId: ext.id,
      meta: {
        internalCode: ext.internalCode,
        serialNumber: ext.serialNumber,
        previousStatus: ext.status,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, deletedAt: now.toISOString() });
  }
  return redirectRelative(`/platform/companies/${companyId}?tab=inventory`, 303);
}
