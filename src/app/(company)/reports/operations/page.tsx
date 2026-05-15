import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getServiceAnalyticsSnapshot,
  parseOperationsReportSearchParams,
  resolvePrimaryCompareRanges,
} from "@/lib/serviceAnalyticsQueries";
import OperationsReportClient from "./OperationsReportClient";

export const dynamic = "force-dynamic";

export default async function OperationsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const raw = parseOperationsReportSearchParams({
    get: (name) => {
      const v = sp[name];
      if (typeof v === "string") return v;
      if (Array.isArray(v) && typeof v[0] === "string") return v[0];
      return null;
    },
  });

  const { primary, compare } = await resolvePrimaryCompareRanges(prisma, session.companyId, raw);
  const primarySnap = await getServiceAnalyticsSnapshot(prisma, session.companyId, primary);
  const compareSnap = compare ? await getServiceAnalyticsSnapshot(prisma, session.companyId, compare) : null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <OperationsReportClient primary={primarySnap} compare={compareSnap} urlState={raw} />
    </main>
  );
}
