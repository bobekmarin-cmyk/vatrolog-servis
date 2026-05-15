import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServiceAnalyticsSnapshot, monthBoundsUtc } from "@/lib/serviceAnalyticsQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/service-analytics?month=YYYY-MM&compare=YYYY-MM
 * Samo ADMIN. Vraća agregate servisiranih stavki (servicedAt u kalendarskom mjesecu UTC).
 */
export async function GET(req: Request) {
  const session = await requireAdminSession();
  const url = new URL(req.url);
  const month = url.searchParams.get("month")?.trim();
  const compare = url.searchParams.get("compare")?.trim() || null;

  if (!month) {
    return NextResponse.json({ error: "Nedostaje parametar month (YYYY-MM)." }, { status: 400 });
  }

  try {
    monthBoundsUtc(month);
    if (compare) monthBoundsUtc(compare);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Neispravan mjesec.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const primary = await getServiceAnalyticsSnapshot(prisma, session.companyId, month);
    const compareSnapshot =
      compare && compare !== month
        ? await getServiceAnalyticsSnapshot(prisma, session.companyId, compare)
        : null;

    return NextResponse.json({
      primary,
      compare: compareSnapshot,
    });
  } catch (e) {
    console.error("service-analytics", e);
    return NextResponse.json({ error: "Greška pri dohvaćanju analitike." }, { status: 500 });
  }
}
