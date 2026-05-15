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
    limit: 30,
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
      customerId: true,
      _count: { select: { items: true, documentLogs: true } },
    },
  });
  if (!wo) {
    return NextResponse.json({ error: "Nalog nije pronaden." }, { status: 404 });
  }
  if (wo.status !== "DRAFT") {
    return NextResponse.json(
      {
        error: `Brisanje je dozvoljeno samo za DRAFT naloge. Trenutni status: ${wo.status}.`,
      },
      { status: 409 },
    );
  }

  const meta = extractAuditMeta(req);

  // Audit PRIJE brisanja (entityId ce postojati u logu i nakon delete-a)
  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.workOrder.delete",
      entity: "WorkOrder",
      entityId: wo.id,
      meta: {
        orderNumber: wo.orderNumber,
        previousStatus: wo.status,
        itemCount: wo._count.items,
        documentLogCount: wo._count.documentLogs,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  await prisma.workOrder.delete({ where: { id: wo.id } });

  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }
  return redirectRelative(`/platform/companies/${companyId}?tab=operations`, 303);
}
