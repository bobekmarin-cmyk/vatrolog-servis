import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import WorkOrderStatusBadge from "@/components/WorkOrderStatusBadge";
import { customerDisplayName } from "@/lib/customerDisplay";
import WeeklyChart from "@/components/WeeklyChart";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

const DAY_NAMES = ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"];

function lastNDaysNoSunday(n: number): Date[] {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (out.length < n) {
    if (d.getDay() !== 0) out.unshift(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  return out;
}

function dayLabel(d: Date) {
  return `${DAY_NAMES[d.getDay()]}\n${d.getDate()}.${d.getMonth() + 1}.`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowDate = new Date(todayStart);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowEnd = endOfDay(tomorrowDate);

  const activeOrders = await prisma.workOrder.findMany({
    where: { companyId: session.companyId, status: { in: ["DRAFT", "IN_PROGRESS"] } },
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      department: { select: { name: true } },
      items: { select: { id: true, servicedAt: true, isPlaceholder: true } },
    },
  });

  const allItems = activeOrders.flatMap((o) => o.items);
  const totalInService = allItems.length;
  const servicedCount = allItems.filter((i) => i.servicedAt).length;
  const remainingCount = totalInService - servicedCount;

  const todayDueItems = await prisma.workOrderItem.count({
    where: {
      companyId: session.companyId,
      servicedAt: null,
      isPlaceholder: false,
      workOrder: { status: { in: ["DRAFT", "IN_PROGRESS"] }, dueAt: { lte: todayEnd } },
    },
  });

  const tomorrowDueItems = await prisma.workOrderItem.count({
    where: {
      companyId: session.companyId,
      servicedAt: null,
      isPlaceholder: false,
      workOrder: {
        status: { in: ["DRAFT", "IN_PROGRESS"] },
        dueAt: { gt: todayEnd, lte: tomorrowEnd },
      },
    },
  });

  const days = lastNDaysNoSunday(7);
  const weekStart = startOfDay(days[0]);
  const weekEnd = endOfDay(days[days.length - 1]);

  const weekItems = await prisma.workOrderItem.findMany({
    where: {
      companyId: session.companyId,
      servicedAt: { gte: weekStart, lte: weekEnd },
    },
    select: { servicedAt: true },
  });

  const chartData = days.map((d) => {
    const ds = startOfDay(d).getTime();
    const de = endOfDay(d).getTime();
    const count = weekItems.filter(
      (i) => i.servicedAt && i.servicedAt.getTime() >= ds && i.servicedAt.getTime() <= de,
    ).length;
    return {
      label: dayLabel(d),
      count,
      isToday: d.getTime() === todayStart.getTime(),
    };
  });

  const weekTotal = chartData.reduce((s, d) => s + d.count, 0);
  const todayServiced = chartData.find((d) => d.isToday)?.count ?? 0;

  const ordersForList = activeOrders.map((o) => {
    const total = o.items.length;
    const serviced = o.items.filter((i) => i.servicedAt).length;
    const remaining = total - serviced;
    return { ...o, total, serviced, remaining };
  });

  const pct = totalInService > 0 ? Math.round((servicedCount / totalInService) * 100) : 0;

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link className="btn btn-outline px-3 text-sm" href="/work-orders">Nalozi</Link>
          <Link className="btn btn-primary px-3 text-sm" href="/work-orders/new">+ Novi radni nalog</Link>
        </div>
      </div>

      <section className="rounded-xl border border-black/10 bg-gradient-to-br from-indigo-50 to-white p-5">
        <h2 className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">Trenutno stanje servisa</h2>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <div className="text-center">
            <div className="text-xs text-slate-500">U servisu</div>
            <div className="text-2xl font-bold tabular-nums text-slate-700">{totalInService}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-emerald-600">Servisirano</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700">{servicedCount}</div>
          </div>
          <div className="text-center rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 -m-1">
            <div className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Preostalo</div>
            <div className="text-4xl font-black tabular-nums text-rose-800">{remainingCount}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-red-600">Danas za napraviti</div>
            <div className="text-2xl font-bold tabular-nums text-red-700">{todayDueItems}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-orange-600">Sutra za napraviti</div>
            <div className="text-2xl font-bold tabular-nums text-orange-700">{tomorrowDueItems}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Napredak</span>
            <span>{pct}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-200">
            <div
              className={`h-3 rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3 surface">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <h2 className="text-sm font-semibold">Otvoreni nalozi ({activeOrders.length})</h2>
            <Link className="text-xs text-blue-600 hover:underline" href="/work-orders">Svi nalozi →</Link>
          </div>
          <div className="h-px bg-black/10" />
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {ordersForList.map((o) => {
              const orderPct = o.total > 0 ? Math.round((o.serviced / o.total) * 100) : 0;
              const allDone = o.remaining === 0 && o.total > 0;
              return (
                <Link key={o.id} href={`/work-orders/${o.id}`} className="flex items-center gap-3 px-4 py-1.5 hover:bg-slate-50 transition-colors">
                  <span className="text-xs text-slate-400 shrink-0">{o.orderNumber}</span>
                  <WorkOrderStatusBadge status={o.status} />
                  <span className="text-sm font-medium text-slate-800 truncate min-w-0 flex-1">
                    {customerDisplayName(o.customer)}{o.department?.name ? ` · ${o.department.name}` : ""}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${allDone ? "text-emerald-600" : "text-slate-700"}`}>{o.serviced}/{o.total}</span>
                  <div className="shrink-0 w-16">
                    <div className="h-1.5 w-full rounded-full bg-slate-200">
                      <div className={`h-1.5 rounded-full ${allDone ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${orderPct}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
            {activeOrders.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="text-sm font-semibold text-slate-700">Još nema otvorenih naloga.</div>
                <p className="mt-1 text-xs text-slate-500">
                  Za početak dodajte prvog kupca ili odmah otvorite radni nalog.
                </p>
                <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                  <Link className="btn btn-outline px-3 text-sm" href="/customers/new">
                    Dodaj prvog kupca
                  </Link>
                  <Link className="btn btn-primary px-3 text-sm" href="/work-orders/new">
                    Otvori prvi nalog
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-2 surface p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold">Servisirano kroz tjedan</h2>
          </div>
          <div className="flex gap-4 text-xs text-slate-500 mb-3">
            <div>Danas: <b className="text-emerald-700">{todayServiced}</b></div>
            <div>Ukupno (7 dana): <b className="text-indigo-700">{weekTotal}</b></div>
          </div>
          <WeeklyChart data={chartData} />
          <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-indigo-500" /> Prethodni dani</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Danas</span>
          </div>
        </section>
      </div>
    </main>
  );
}
