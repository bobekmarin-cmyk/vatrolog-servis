import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  currentYmUtc,
  getServiceAnalyticsSnapshot,
  monthBoundsUtc,
} from "@/lib/serviceAnalyticsQueries";
import OperationsReportClient from "./OperationsReportClient";

export const dynamic = "force-dynamic";

export default async function OperationsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; compare?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const defaultYm = currentYmUtc();
  const monthRaw = sp.month?.trim();
  let month = defaultYm;
  if (monthRaw && /^\d{4}-\d{2}$/.test(monthRaw)) {
    try {
      monthBoundsUtc(monthRaw);
      month = monthRaw;
    } catch {
      month = defaultYm;
    }
  }

  let compareYm: string | null = sp.compare?.trim() ?? null;
  if (compareYm) {
    try {
      monthBoundsUtc(compareYm);
      if (compareYm === month) compareYm = null;
    } catch {
      compareYm = null;
    }
  }

  const primary = await getServiceAnalyticsSnapshot(prisma, session.companyId, month);
  const compare = compareYm ? await getServiceAnalyticsSnapshot(prisma, session.companyId, compareYm) : null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <OperationsReportClient primary={primary} compare={compare} month={month} compareYm={compareYm} />
    </main>
  );
}
