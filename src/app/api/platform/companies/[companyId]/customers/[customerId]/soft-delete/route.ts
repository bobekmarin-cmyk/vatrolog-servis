import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { redirectRelative } from "@/lib/httpRedirect";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { extractAuditMeta } from "@/lib/auditLog";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string; customerId: string }> },
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

  const { companyId, customerId } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true, name: true, oib: true, deletedAt: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Kupac nije pronaden." }, { status: 404 });
  }
  if (customer.deletedAt) {
    return NextResponse.json(
      { error: "Kupac je vec soft-deletan." },
      { status: 409 },
    );
  }

  const now = new Date();
  await prisma.customer.update({
    where: { id: customer.id },
    data: { deletedAt: now },
  });

  const meta = extractAuditMeta(req);
  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.customer.softDelete",
      entity: "Customer",
      entityId: customer.id,
      meta: { name: customer.name, oib: customer.oib },
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, deletedAt: now.toISOString() });
  }
  return redirectRelative(`/platform/companies/${companyId}?tab=inventory`, 303);
}
