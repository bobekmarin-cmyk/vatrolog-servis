import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { FEATURE_KEYS, getCompanyFeatures, isFeatureEnabledForRole } from "@/lib/companyFeatures";

import { redirectRelative } from "@/lib/httpRedirect";
function isValidYm(ym: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(ym)) return false;
  const [y, m] = ym.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return false;
  const d = new Date(y, m - 1, 1);
  return d.getFullYear() === y && d.getMonth() === m - 1;
}

function startOfMonthFromYm(ym: string) {
  const [y, m] = ym.split("-").map((x) => Number(x));
  return new Date(y, m - 1, 1);
}
function addMonths(d: Date, months: number) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  const features = await getCompanyFeatures(session.companyId);
  const allowed = isFeatureEnabledForRole(session.role, features, FEATURE_KEYS.REPORTS_MONTHLY);
  if (!allowed) return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });

  const form = await req.formData();

  const customerId = String(form.get("customerId") || "");
  const month = String(form.get("month") || ""); // "YYYY-MM"
  const ignoreCount = Number(form.get("ignoreCount") || 0);
  const mode = String(form.get("mode") || "NONE"); // NONE | M1 | M3 | INF
  const allowedModes = new Set(["NONE", "M1", "M3", "INF"]);
  if (!allowedModes.has(mode)) {
    return NextResponse.json({ error: "Neispravan mode (NONE, M1, M3, INF)." }, { status: 400 });
  }

  if (!customerId || !month) {
    return NextResponse.json({ error: "Missing customerId/month" }, { status: 400 });
  }
  if (!isValidYm(month)) {
    return NextResponse.json({ error: "Mjesec mora biti u obliku YYYY-MM (npr. 2026-02)." }, { status: 400 });
  }
  if (!Number.isFinite(ignoreCount) || ignoreCount < 0) {
    return NextResponse.json({ error: "ignoreCount invalid" }, { status: 400 });
  }

  const monthStart = startOfMonthFromYm(month);
  if (Number.isNaN(monthStart.getTime())) {
    return NextResponse.json({ error: "Neispravan mjesec." }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Kupac nije pronađen (ili nije u tvojoj tvrtki)." }, { status: 404 });
  }

  let validUntil: Date | null = null;
  if (mode === "M1") validUntil = addMonths(monthStart, 1);
  if (mode === "M3") validUntil = addMonths(monthStart, 3);
  if (mode === "INF") validUntil = null;
  if (mode === "NONE") validUntil = addMonths(monthStart, 0); // tretiraj kao “ne vrijedi”, ali ćemo ignoreCount=0

  await prisma.customerBacklogSnooze.upsert({
    where: { customerId_monthStart: { customerId, monthStart } },
    create: {
      customerId,
      monthStart,
      ignoreCount: mode === "NONE" ? 0 : ignoreCount,
      validUntil: mode === "NONE" ? addMonths(monthStart, 0) : validUntil,
    },
    update: {
      ignoreCount: mode === "NONE" ? 0 : ignoreCount,
      validUntil: mode === "NONE" ? addMonths(monthStart, 0) : validUntil,
    },
  });

  return redirectRelative(`/reports/monthly?month=${month}`, 303);
}
