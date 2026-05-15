import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { redirectRelative } from "@/lib/httpRedirect";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { extractAuditMeta } from "@/lib/auditLog";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string; workOrderId: string }> },
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

  const { companyId, workOrderId } = await params;

  const wo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      lockedAt: true,
      lockedById: true,
    },
  });
  if (!wo) {
    return NextResponse.json({ error: "Nalog nije pronaden." }, { status: 404 });
  }
  if (wo.status !== "LOCKED") {
    return NextResponse.json(
      { error: `Nalog nije zakljucan (status: ${wo.status}).` },
      { status: 409 },
    );
  }

  await prisma.workOrder.update({
    where: { id: wo.id },
    data: { status: "IN_PROGRESS", lockedAt: null, lockedById: null },
  });

  const meta = extractAuditMeta(req);
  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.workOrder.unlock",
      entity: "WorkOrder",
      entityId: wo.id,
      meta: {
        orderNumber: wo.orderNumber,
        previousLockedAt: wo.lockedAt?.toISOString() ?? null,
        previousLockedById: wo.lockedById,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }
  return redirectRelative(`/platform/companies/${companyId}?tab=operations`, 303);
}
