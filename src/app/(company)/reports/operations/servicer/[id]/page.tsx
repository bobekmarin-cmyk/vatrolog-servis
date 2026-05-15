import Link from "next/link";
import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  operationsReportSearchParamsToUrl,
  parseOperationsReportSearchParams,
  resolvePrimaryCompareRanges,
} from "@/lib/serviceAnalyticsQueries";
import { getServicerDetailSnapshot } from "@/lib/servicerAnalyticsQueries";
import { isActiveToday } from "@/lib/servicerStatus";

function fmtTs(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy}. ${hh}:${min}`;
}

export const dynamic = "force-dynamic";

export default async function ServicerOperationsReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const sp = await searchParams;
  const raw = parseOperationsReportSearchParams({
    get: (name) => {
      const v = sp[name];
      if (typeof v === "string") return v;
      if (Array.isArray(v) && typeof v[0] === "string") return v[0];
      return null;
    },
  });

  const { primary } = await resolvePrimaryCompareRanges(prisma, session.companyId, raw);
  const detail = await getServicerDetailSnapshot(
    prisma,
    session.companyId,
    id,
    primary.from,
    primary.toExclusive,
    primary.label,
  );
  if (!detail) notFound();

  const user = await prisma.user.findFirst({
    where: { id, companyId: session.companyId },
    select: { activatedAt: true },
  });
  const activeToday = user ? isActiveToday(user.activatedAt) : false;

  const backQuery = operationsReportSearchParamsToUrl(raw);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Servisna analitika</p>
          <h1 className="text-2xl font-bold text-slate-900">{detail.fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${activeToday ? "bg-emerald-500" : "bg-slate-300"}`}
            />
            <span className="text-sm text-slate-500">{activeToday ? "Aktivan danas" : "Neaktivan danas"}</span>
            {!detail.active ? (
              <span className="badge badge-neutral badge-tight">Deaktiviran</span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-600">Razdoblje: {detail.rangeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/reports/operations?${backQuery}`} className="btn btn-outline px-4">
            ← Natrag na analitiku
          </Link>
          <Link href="/admin/settings/servicers" className="btn btn-outline px-4">
            Postavke servisera
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
          <div className="text-xs text-slate-500">Servisirano</div>
          <div className="text-2xl font-bold tabular-nums text-slate-900">{detail.totals.serviced}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
          <div className="text-xs text-slate-500">UP (kom) / %</div>
          <div className="text-2xl font-bold tabular-nums text-indigo-800">
            {detail.totals.internalDone}{" "}
            <span className="text-lg text-slate-600">({detail.totals.upPercent}%)</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
          <div className="text-xs text-slate-500">Radnih dana</div>
          <div className="text-2xl font-bold tabular-nums text-slate-900">{detail.totals.distinctDays}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
          <div className="text-xs text-slate-500">Prosjek / dan</div>
          <div className="text-2xl font-bold tabular-nums text-indigo-700">{detail.totals.avgPerDay}</div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Mjesečna statistika u razdoblju</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-4 py-2">Mjesec</th>
                <th className="px-4 py-2 text-right">Servisirano</th>
                <th className="px-4 py-2 text-right">Radnih dana</th>
                <th className="px-4 py-2 text-right">Prosjek/dan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.monthly.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    Nema servisiranih stavki u ovom razdoblju.
                  </td>
                </tr>
              ) : null}
              {detail.monthly.map((m) => (
                <tr key={m.monthKey} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium">{m.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.days}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.avgPerDay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Zadnja servisiranja u razdoblju</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-4 py-2">Datum</th>
                <th className="px-4 py-2">Interni kod</th>
                <th className="px-4 py-2">Proizvođač</th>
                <th className="px-4 py-2">Tip</th>
                <th className="px-4 py-2">Nalog</th>
                <th className="px-4 py-2">Kupac</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.lastServices.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Nema zapisa.
                  </td>
                </tr>
              ) : null}
              {detail.lastServices.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-2 text-xs">{fmtTs(item.servicedAtIso)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{item.internalCode ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{item.manufacturerLabel ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{item.typeLabel ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/work-orders/${item.workOrderId}`}
                      className="text-xs text-indigo-700 hover:underline"
                    >
                      {item.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs">{item.customerLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
