import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getServiceAnalyticsSnapshot,
  parseOperationsReportSearchParams,
  resolvePrimaryCompareRanges,
} from "@/lib/serviceAnalyticsQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/service-analytics?mode=month|year|all&month=YYYY-MM&compare=…&year=YYYY&compareYear=…
 * Samo ADMIN.
 */
export async function GET(req: Request) {
  const session = await requireAdminSession();
  const url = new URL(req.url);

  const raw = parseOperationsReportSearchParams(url.searchParams);

  try {
    const { primary, compare } = await resolvePrimaryCompareRanges(prisma, session.companyId, raw);
    const primarySnap = await getServiceAnalyticsSnapshot(prisma, session.companyId, primary);
    const compareSnap = compare ? await getServiceAnalyticsSnapshot(prisma, session.companyId, compare) : null;

    return NextResponse.json({
      primary: primarySnap,
      compare: compareSnap,
    });
  } catch (e) {
    console.error("service-analytics", e);
    return NextResponse.json({ error: "Greška pri dohvaćanju analitike." }, { status: 500 });
  }
}
