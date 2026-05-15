"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ServiceAnalyticsSnapshot } from "@/lib/serviceAnalyticsQueries";
import { currentYmUtc, monthLabelHr, shiftMonthYm } from "@/lib/serviceAnalyticsQueries";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#64748b",
];

function deltaLabel(cur: number, prev: number | null): { text: string; tone: "up" | "down" | "flat" | "na" } {
  if (prev === null) return { text: "", tone: "na" };
  const d = cur - prev;
  if (d === 0) return { text: "±0", tone: "flat" };
  const pct = prev === 0 ? null : Math.round((10000 * d) / prev) / 100;
  const pctStr = pct === null ? "" : ` (${pct > 0 ? "+" : ""}${pct}%)`;
  return { text: `${d > 0 ? "+" : ""}${d}${pctStr}`, tone: d > 0 ? "up" : "down" };
}

function pieData(rows: { label: string; count: number }[], max = 8) {
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  if (sorted.length <= max) return sorted;
  const head = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1).reduce((s, r) => s + r.count, 0);
  return [...head, { label: "Ostalo", count: rest }];
}

export default function OperationsReportClient(props: {
  primary: ServiceAnalyticsSnapshot;
  compare: ServiceAnalyticsSnapshot | null;
  month: string;
  compareYm: string | null;
}) {
  const { primary, compare, month, compareYm } = props;
  const router = useRouter();
  const nowYm = currentYmUtc();

  function href(nextMonth: string, nextCompare: string | null) {
    const u = new URLSearchParams();
    u.set("month", nextMonth);
    if (nextCompare) u.set("compare", nextCompare);
    return `/reports/operations?${u.toString()}`;
  }

  const agentPie = pieData(primary.byAgent.map((r) => ({ label: r.label, count: r.count })));
  const constructionPie = pieData(
    primary.byConstruction.map((r) => ({ label: r.label, count: r.count })),
  );
  const barManu = primary.byManufacturer.slice(0, 12).map((r) => ({ name: r.label, count: r.count }));

  const dPrimary = deltaLabel(primary.totals.serviced, compare?.totals.serviced ?? null);
  const dUp = deltaLabel(primary.totals.upPercent, compare?.totals.upPercent ?? null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Servisna analitika</h1>
          <p className="text-sm text-slate-600">
            Servisirane stavke: <code className="rounded bg-slate-100 px-1">servicedAt</code> u mjesecu, s označenim
            unutarnjim pregledom (UP) gdje je <code className="rounded bg-slate-100 px-1">internalDone</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={href(nowYm, compareYm)}
            className={
              "rounded-md border px-3 py-1.5 text-sm font-medium " +
              (month === nowYm ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white hover:bg-slate-50")
            }
          >
            Ovaj mjesec
          </Link>
          <Link
            href={href(shiftMonthYm(nowYm, -1), compareYm)}
            className={
              "rounded-md border px-3 py-1.5 text-sm font-medium " +
              (month === shiftMonthYm(nowYm, -1)
                ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                : "border-slate-200 bg-white hover:bg-slate-50")
            }
          >
            Prošli mjesec
          </Link>
          <Link
            href={href(shiftMonthYm(month, -1), compareYm)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ← Prethodni
          </Link>
          <Link
            href={href(shiftMonthYm(month, 1), compareYm)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Sljedeći →
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Mjesec</span>
            <input
              type="month"
              className="input h-9 w-44 text-sm"
              value={month}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const ym = `${v.slice(0, 4)}-${v.slice(5, 7)}`;
                router.push(href(ym, compareYm));
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Usporedi s</span>
            <select
              className="input h-9 min-w-[200px] text-sm"
              value={compareYm ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                router.push(href(month, v || null));
              }}
            >
              <option value="">— bez usporedbe —</option>
              <option value={shiftMonthYm(month, -1)}>{monthLabelHr(shiftMonthYm(month, -1))}</option>
              <option value={shiftMonthYm(month, -2)}>{monthLabelHr(shiftMonthYm(month, -2))}</option>
              <option value={shiftMonthYm(month, 1)}>{monthLabelHr(shiftMonthYm(month, 1))}</option>
              <option value={shiftMonthYm(nowYm, -1)}>{monthLabelHr(shiftMonthYm(nowYm, -1))} (prošli od danas)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Servisirano (stavke)"
          value={primary.totals.serviced}
          subtitle={primary.label}
          compareValue={compare?.totals.serviced}
          compareLabel={compare?.label}
          delta={dPrimary}
        />
        <KpiCard
          title="UP odrađen (%)"
          value={primary.totals.upPercent}
          subtitle="udio stavki s internalDone"
          compareValue={compare?.totals.upPercent}
          compareLabel={compare?.label}
          delta={dUp}
          suffix="%"
        />
        <KpiCard
          title="UP (kom)"
          value={primary.totals.internalDone}
          subtitle={`od ${primary.totals.serviced} servisiranih`}
          compareValue={compare?.totals.internalDone}
          compareLabel={compare?.label}
          delta={deltaLabel(primary.totals.internalDone, compare?.totals.internalDone ?? null)}
        />
      </div>

      {primary.totals.serviced === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Nema servisiranih stavki u odabranom mjesecu.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Medij (sredstvo gašenja)</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={agentPie} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                  {agentPie.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Izvedba aparata</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={constructionPie}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {constructionPie.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Servisirano po danu</h2>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={compare ? mergeByDay(primary.byDay, compare.byDay) : primary.byDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" name={primary.label} stroke="#6366f1" strokeWidth={2} dot={false} />
              {compare ? (
                <Line
                  type="monotone"
                  dataKey="compareCount"
                  name={compare.label}
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {compare ? (
          <p className="mt-2 text-xs text-slate-500">
            Zelena linija: usporedbeni mjesec (isti kalendar dani; dan bez servisa = 0).
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Top proizvođači</h2>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barManu} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" name="Stavke" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DataTable
        title="Proizvođač (detalj + UP %)"
        rows={primary.byManufacturer}
        empty={primary.byManufacturer.length === 0}
      />
      <DataTable
        title="Tip aparata (do 40)"
        rows={primary.byType.map((t) => ({
          key: t.typeId,
          label: t.label,
          count: t.count,
          internalDone: t.internalDone,
          upPercent: t.upPercent,
        }))}
        empty={primary.byType.length === 0}
      />
      <DataTable title="Medij (detalj)" rows={primary.byAgent} empty={primary.byAgent.length === 0} />
      <DataTable title="Izvedba (detalj)" rows={primary.byConstruction} empty={primary.byConstruction.length === 0} />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Serviseri</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                <th className="py-2 pr-3">Serviser</th>
                <th className="py-2 pr-3">Stavke</th>
                <th className="py-2 pr-3">Radnih dana</th>
                <th className="py-2 pr-3">Prosjek / dan</th>
                <th className="py-2">Top tipovi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {primary.byServicer.map((s) => (
                <tr key={s.servicerId ?? "none"}>
                  <td className="py-2 pr-3 font-medium text-slate-900">{s.servicerName}</td>
                  <td className="py-2 pr-3 tabular-nums">{s.count}</td>
                  <td className="py-2 pr-3 tabular-nums">{s.distinctDays}</td>
                  <td className="py-2 pr-3 tabular-nums">{s.avgPerDay}</td>
                  <td className="py-2 text-slate-600">
                    {s.topTypes.length === 0
                      ? "—"
                      : s.topTypes.map((t) => `${t.label} (${t.count})`).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function mergeByDay(
  a: { day: string; count: number }[],
  b: { day: string; count: number }[],
): Array<{ day: string; count: number; compareCount: number }> {
  const map = new Map<string, { day: string; count: number; compareCount: number }>();
  for (const x of a) {
    map.set(x.day, { day: x.day, count: x.count, compareCount: 0 });
  }
  for (const x of b) {
    const ex = map.get(x.day);
    if (ex) ex.compareCount = x.count;
    else map.set(x.day, { day: x.day, count: 0, compareCount: x.count });
  }
  return [...map.values()].sort((p, q) => p.day.localeCompare(q.day));
}

function KpiCard(props: {
  title: string;
  value: number;
  subtitle: string;
  compareValue?: number;
  compareLabel?: string;
  delta: { text: string; tone: string };
  suffix?: string;
}) {
  const { title, value, subtitle, compareValue, compareLabel, delta, suffix = "" } = props;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
        {value}
        {suffix}
      </div>
      <div className="text-xs text-slate-500">{subtitle}</div>
      {compareValue !== undefined && compareLabel ? (
        <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
          <div>
            Usporedba ({compareLabel}): <span className="font-semibold">{compareValue}{suffix}</span>
          </div>
          {delta.text ? (
            <div
              className={
                delta.tone === "up"
                  ? "text-emerald-700"
                  : delta.tone === "down"
                    ? "text-rose-700"
                    : "text-slate-600"
              }
            >
              Razlika: {delta.text}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DataTable(props: {
  title: string;
  rows: Array<{ key: string; label: string; count: number; internalDone: number; upPercent: number }>;
  empty: boolean;
}) {
  const { title, rows, empty } = props;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {empty ? (
        <p className="text-sm text-slate-500">Nema podataka.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                <th className="py-2 pr-3">Naziv</th>
                <th className="py-2 pr-3">Stavke</th>
                <th className="py-2 pr-3">UP (kom)</th>
                <th className="py-2">UP %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="py-2 pr-3 text-slate-800">{r.label}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.count}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.internalDone}</td>
                  <td className="py-2 tabular-nums">{r.upPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
