import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { redirectRelative } from "@/lib/httpRedirect";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { extractAuditMeta } from "@/lib/auditLog";
import { hardPurgeCompany } from "@/lib/companyHardPurge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trajno briše tvrtku. Form body: confirmName (mora točno odgovarati nazivu).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const rl = await checkRateLimit("platformWrite", clientKeyFromRequest(req), {
    limit: 5,
    windowSec: 60,
  });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše zahtjeva. Pokušaj za ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const { companyId } = await params;
  const form = await req.formData();
  const confirmName = String(form.get("confirmName") ?? "").trim();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, oib: true, serviceCode: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 404 });
  }

  if (!confirmName || confirmName !== company.name) {
    return redirectRelative(
      `/platform/companies/${companyId}?tab=danger&hardPurge=name_mismatch`,
      303,
    );
  }

  try {
    const result = await hardPurgeCompany(companyId);
    const meta = extractAuditMeta(req);
    await prisma.auditLog.create({
      data: {
        companyId: null,
        actorType: "PLATFORM",
        action: "platform.company.hard_purge",
        entity: "Company",
        entityId: companyId,
        meta: {
          ...result,
          platformUserId: ps.platformUserId,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    if (req.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ ok: true, ...result });
    }
    return redirectRelative(
      `/platform/companies?hardPurge=ok&name=${encodeURIComponent(result.companyName)}`,
      303,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (req.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return redirectRelative(
      `/platform/companies/${companyId}?tab=danger&hardPurge=error`,
      303,
    );
  }
}
