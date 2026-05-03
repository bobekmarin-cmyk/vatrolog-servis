import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { isActiveToday } from "@/lib/servicerStatus";
import SetPinButton from "@/components/SetPinButton";

function fmtTs(d: Date | null | undefined): string {
  if (!d) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy}. ${hh}:${min}`;
}

const MONTH_NAMES = ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj", "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"];

export default async function ServicerAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const { id } = await params;

  const user = await prisma.user.findFirst({
    where: { id, companyId: session.companyId },
  });
  if (!user) notFound();

  const allServiced = await prisma.workOrderItem.findMany({
    where: { servicerId: id, servicedAt: { not: null } },
    select: { servicedAt: true },
    orderBy: { servicedAt: "desc" },
  });

  const totalAllTime = allServiced.length;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const thisMonthCount = allServiced.filter(
    (i) => i.servicedAt! >= thisMonthStart && i.servicedAt! < thisMonthEnd,
  ).length;

  const lastMonthCount = allServiced.filter(
    (i) => i.servicedAt! >= lastMonthStart && i.servicedAt! < thisMonthStart,
  ).length;

  const distinctDays = new Set(
    allServiced.map((i) => {
      const d = i.servicedAt!;
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );
  const avgPerDay = distinctDays.size > 0 ? (totalAllTime / distinctDays.size).toFixed(1) : "0";

  const monthlyData: { label: string; count: number; days: number; avg: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const items = allServiced.filter(
      (it) => it.servicedAt! >= mStart && it.servicedAt! < mEnd,
    );
    const daysSet = new Set(
      items.map((it) => {
        const d = it.servicedAt!;
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      }),
    );
    monthlyData.push({
      label: `${MONTH_NAMES[mStart.getMonth()]} ${mStart.getFullYear()}`,
      count: items.length,
      days: daysSet.size,
      avg: daysSet.size > 0 ? (items.length / daysSet.size).toFixed(1) : "-",
    });
  }

  const last10 = await prisma.workOrderItem.findMany({
    where: { servicerId: id, servicedAt: { not: null } },
    orderBy: { servicedAt: "desc" },
    take: 10,
    include: {
      extinguisher: { include: { manufacturer: true, type: { include: { agent: true, construction: true } } } },
      workOrder: { include: { customer: true } },
    },
  });

  const activeToday = isActiveToday(user.activatedAt);

  return (
    <main className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{user.fullName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${activeToday ? "bg-emerald-500" : "bg-slate-300"}`} />
            <span className="text-sm text-slate-500">{activeToday ? "Aktivan danas" : "Neaktivan danas"}</span>
            {!user.active && <span className="badge badge-neutral badge-tight">Deaktiviran</span>}
            <SetPinButton servicerId={user.id} hasPin={!!user.pin} />
          </div>
        </div>
        <Link className="btn btn-outline px-4" href="/admin/settings/servicers">
          ← Serviseri
        </Link>
      </div>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="surface p-4 text-center">
          <div className="text-xs text-slate-500">Prosjek / radni dan</div>
          <div className="text-2xl font-bold tabular-nums text-indigo-700">{avgPerDay}</div>
        </div>
        <div className="surface p-4 text-center">
          <div className="text-xs text-slate-500">Ovaj mjesec</div>
          <div className="text-2xl font-bold tabular-nums text-slate-800">{thisMonthCount}</div>
        </div>
        <div className="surface p-4 text-center">
          <div className="text-xs text-slate-500">Prošli mjesec</div>
          <div className="text-2xl font-bold tabular-nums text-slate-800">{lastMonthCount}</div>
        </div>
        <div className="surface p-4 text-center">
          <div className="text-xs text-slate-500">Ukupno (sveukupno)</div>
          <div className="text-2xl font-bold tabular-nums text-slate-800">{totalAllTime}</div>
        </div>
      </section>

      {/* MONTHLY TABLE */}
      <section className="surface">
        <div className="px-4 pt-3 pb-2">
          <h2 className="text-sm font-semibold">Mjesečna statistika (zadnjih 6 mjeseci)</h2>
        </div>
        <div className="h-px bg-black/10" />
        <div className="overflow-x-auto">
          <table className="table text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-2">Mjesec</th>
                <th className="px-4 py-2 text-right">Servisirano</th>
                <th className="px-4 py-2 text-right">Radnih dana</th>
                <th className="px-4 py-2 text-right">Prosjek/dan</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {monthlyData.map((m) => (
                <tr key={m.label} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium">{m.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.days}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.avg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* LAST 10 */}
      <section className="surface">
        <div className="px-4 pt-3 pb-2">
          <h2 className="text-sm font-semibold">Zadnjih 10 servisiranih aparata</h2>
        </div>
        <div className="h-px bg-black/10" />
        <div className="overflow-x-auto">
          <table className="table text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-2">Datum</th>
                <th className="px-4 py-2">Interni kod</th>
                <th className="px-4 py-2">Proizvođač</th>
                <th className="px-4 py-2">Tip</th>
                <th className="px-4 py-2">Nalog</th>
                <th className="px-4 py-2">Kupac</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {last10.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-400" colSpan={6}>Nema servisiranih aparata.</td>
                </tr>
              ) : null}
              {last10.map((item) => {
                const ex = item.extinguisher;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2 whitespace-nowrap text-xs">{fmtTs(item.servicedAt)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{ex?.internalCode ?? "-"}</td>
                    <td className="px-4 py-2 text-xs">{ex ? displayManufacturer(ex.manufacturer) : "-"}</td>
                    <td className="px-4 py-2 text-xs">{ex?.type ? formatExtinguisherTypeName(ex.type) : "-"}</td>
                    <td className="px-4 py-2">
                      <Link href={`/work-orders/${item.workOrder.id}`} className="text-blue-600 hover:underline text-xs">
                        {item.workOrder.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs">{customerDisplayName(item.workOrder.customer)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
