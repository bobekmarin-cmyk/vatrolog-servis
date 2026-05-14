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

const HR_LONG_DATE = new Intl.DateTimeFormat("hr-HR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const HR_SHORT_DATE = new Intl.DateTimeFormat("hr-HR", {
  day: "numeric",
  month: "numeric",
});

type DueTone = "overdue" | "today" | "soon" | "later";

function relativeDueLabel(due: Date, todayStart: Date): { text: string; tone: DueTone } {
  const dueStart = startOfDay(due);
  const diffDays = Math.round((dueStart.getTime() - todayStart.getTime()) / 86_400_000);
  if (diffDays < 0) return { text: `Kasni ${Math.abs(diffDays)} d`, tone: "overdue" };
  if (diffDays === 0) return { text: "Danas", tone: "today" };
  if (diffDays === 1) return { text: "Sutra", tone: "soon" };
  if (diffDays <= 3) return { text: `Za ${diffDays} d`, tone: "soon" };
  return { text: `Za ${diffDays} d`, tone: "later" };
}

const DUE_TONE_CLASSES: Record<DueTone, string> = {
  overdue: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  today: "bg-red-50 text-red-700 ring-1 ring-red-200",
  soon: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  later: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

type StatCardTone = "neutral" | "success" | "danger" | "brand" | "warning";

const STAT_TONE: Record<
  StatCardTone,
  { ring: string; iconBg: string; iconText: string; value: string }
> = {
  neutral: {
    ring: "ring-slate-200",
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
    value: "text-slate-900",
  },
  success: {
    ring: "ring-emerald-200",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    value: "text-emerald-700",
  },
  danger: {
    ring: "ring-rose-200",
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
    value: "text-rose-700",
  },
  brand: {
    ring: "ring-red-200",
    iconBg: "bg-red-50",
    iconText: "text-red-600",
    value: "text-red-700",
  },
  warning: {
    ring: "ring-amber-200",
    iconBg: "bg-amber-50",
    iconText: "text-amber-700",
    value: "text-amber-700",
  },
};

function StatCard({
  label,
  value,
  icon,
  tone,
  emphasize,
}: {
  label: string;
  value: number | string;
  icon: string;
  tone: StatCardTone;
  emphasize?: boolean;
}) {
  const t = STAT_TONE[tone];
  return (
    <div
      className={[
        "rounded-2xl bg-white p-4 shadow-sm ring-1 transition-shadow hover:shadow",
        t.ring,
        emphasize ? "ring-2" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div
          className={[
            "flex h-9 w-9 items-center justify-center rounded-xl text-base",
            t.iconBg,
            t.iconText,
          ].join(" ")}
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </div>
          <div
            className={[
              "tabular-nums leading-tight",
              emphasize ? "text-3xl font-black" : "text-2xl font-bold",
              t.value,
            ].join(" ")}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
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

  const upcomingDueOrders = await prisma.workOrder.findMany({
    where: {
      companyId: session.companyId,
      status: { in: ["DRAFT", "IN_PROGRESS"] },
      dueAt: { not: null },
    },
    orderBy: { dueAt: "asc" },
    take: 5,
    include: {
      customer: true,
      department: { select: { name: true } },
    },
  });

  const ordersForList = activeOrders.map((o) => {
    const total = o.items.length;
    const serviced = o.items.filter((i) => i.servicedAt).length;
    const remaining = total - serviced;
    return { ...o, total, serviced, remaining };
  });

  const pct = totalInService > 0 ? Math.round((servicedCount / totalInService) * 100) : 0;
  const todayLabelLong = HR_LONG_DATE.format(now);

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-red-600">
            Pregled servisa
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 first-letter:uppercase">{todayLabelLong}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-outline px-3 text-sm" href="/work-orders">
            Svi nalozi
          </Link>
          <Link className="btn btn-outline px-3 text-sm" href="/reports/monthly">
            Plan servisa
          </Link>
          <Link className="btn btn-primary px-3 text-sm" href="/work-orders/new">
            + Novi radni nalog
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="U servisu" value={totalInService} icon="📦" tone="neutral" />
        <StatCard label="Servisirano" value={servicedCount} icon="✅" tone="success" />
        <StatCard
          label="Preostalo"
          value={remainingCount}
          icon="🛠️"
          tone="danger"
          emphasize
        />
        <StatCard label="Danas" value={todayDueItems} icon="📅" tone="brand" />
        <StatCard label="Sutra" value={tomorrowDueItems} icon="⏭️" tone="warning" />
      </section>

      <section className="surface px-4 py-3">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Napredak servisiranja</span>
          <span className="tabular-nums text-slate-500">
            {servicedCount} / {totalInService} ·{" "}
            <span className={pct === 100 ? "text-emerald-700" : "text-red-700"}>{pct}%</span>
          </span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-3 rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-red-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="surface lg:col-span-3">
          <div className="surface-header pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Otvoreni nalozi</h2>
              <p className="text-xs text-slate-500">{activeOrders.length} aktivnih radnih naloga</p>
            </div>
            <Link className="text-xs font-medium text-red-600 hover:underline" href="/work-orders">
              Svi nalozi →
            </Link>
          </div>
          <div className="h-px bg-black/5" />
          <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
            {ordersForList.map((o) => {
              const orderPct = o.total > 0 ? Math.round((o.serviced / o.total) * 100) : 0;
              const allDone = o.remaining === 0 && o.total > 0;
              return (
                <Link
                  key={o.id}
                  href={`/work-orders/${o.id}`}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50"
                >
                  <span className="shrink-0 font-mono text-xs text-slate-500">{o.orderNumber}</span>
                  <WorkOrderStatusBadge status={o.status} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 group-hover:text-slate-900">
                    {customerDisplayName(o.customer)}
                    {o.department?.name ? (
                      <span className="text-slate-500"> · {o.department.name}</span>
                    ) : null}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums text-sm font-semibold ${allDone ? "text-emerald-600" : "text-slate-700"}`}
                  >
                    {o.serviced}/{o.total}
                  </span>
                  <div className="hidden w-20 shrink-0 sm:block">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-1.5 rounded-full ${allDone ? "bg-emerald-500" : "bg-red-600"}`}
                        style={{ width: `${orderPct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
            {activeOrders.length === 0 && (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                  🧾
                </div>
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

        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Servisirano kroz tjedan</h2>
                <p className="text-xs text-slate-500">Posljednjih 7 radnih dana</p>
              </div>
              <div className="flex gap-3 text-[11px] text-slate-500">
                <div className="text-right">
                  <div>Danas</div>
                  <div className="text-sm font-semibold text-emerald-700">{todayServiced}</div>
                </div>
                <div className="text-right">
                  <div>Tjedan</div>
                  <div className="text-sm font-semibold text-red-700">{weekTotal}</div>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <WeeklyChart data={chartData} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-600">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-indigo-500" /> Prethodni dani
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Danas
              </span>
            </div>
          </section>

          <section className="surface">
            <div className="surface-header pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Nadolazeći rokovi</h2>
                <p className="text-xs text-slate-500">Sljedećih 5 naloga po roku</p>
              </div>
              <Link
                className="text-xs font-medium text-red-600 hover:underline"
                href="/work-orders"
              >
                Svi →
              </Link>
            </div>
            <div className="h-px bg-black/5" />
            {upcomingDueOrders.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                Nema naloga s postavljenim rokom.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingDueOrders.map((o) => {
                  const due = o.dueAt as Date;
                  const rel = relativeDueLabel(due, todayStart);
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/work-orders/${o.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-800">
                            {customerDisplayName(o.customer)}
                            {o.department?.name ? (
                              <span className="text-slate-500"> · {o.department.name}</span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-mono">{o.orderNumber}</span>
                            <span>·</span>
                            <span>{HR_SHORT_DATE.format(due)}</span>
                          </div>
                        </div>
                        <span
                          className={[
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            DUE_TONE_CLASSES[rel.tone],
                          ].join(" ")}
                        >
                          {rel.text}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
