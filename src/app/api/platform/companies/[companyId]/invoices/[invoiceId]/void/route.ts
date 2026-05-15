import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { redirectRelative } from "@/lib/httpRedirect";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { extractAuditMeta } from "@/lib/auditLog";

const VOIDABLE_STATUSES = new Set(["DRAFT", "ISSUED", "OVERDUE"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string; invoiceId: string }> },
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

  const { companyId, invoiceId } = await params;

  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { id: true, number: true, status: true, total: true },
  });
  if (!inv) {
    return NextResponse.json({ error: "Racun nije pronaden." }, { status: 404 });
  }
  if (!VOIDABLE_STATUSES.has(inv.status)) {
    return NextResponse.json(
      {
        error: `Void je dozvoljen samo za DRAFT/ISSUED/OVERDUE. Trenutni status: ${inv.status}.`,
      },
      { status: 409 },
    );
  }

  await prisma.invoice.update({
    where: { id: inv.id },
    data: { status: "VOID" },
  });

  const meta = extractAuditMeta(req);
  await prisma.auditLog.create({
    data: {
      companyId,
      actorType: "PLATFORM",
      action: "platform.invoice.void",
      entity: "Invoice",
      entityId: inv.id,
      meta: {
        number: inv.number,
        previousStatus: inv.status,
        total: Number(inv.total),
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
