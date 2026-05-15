"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  OperationsReportUrlState,
  ServiceAnalyticsSnapshot,
  TrendRow,
} from "@/lib/serviceAnalyticsQueries";
import {
  currentYmUtc,
  currentYearUtc,
  monthLabelHr,
  operationsReportSearchParamsToUrl,
  shiftMonthYm,
} from "@/lib/serviceAnalyticsQueries";
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

const MONTH_CHART = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"];

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

function mergeUrlState(
  current: OperationsReportUrlState,
  patch: Partial<OperationsReportUrlState>,
): OperationsReportUrlState {
  return {
    mode: patch.mode ?? current.mode,
    monthYm: patch.monthYm ?? current.monthYm,
    yearY: patch.yearY ?? current.yearY,
    compareMonthYm: patch.compareMonthYm !== undefined ? patch.compareMonthYm : current.compareMonthYm,
    compareYearY: patch.compareYearY !== undefined ? patch.compareYearY : current.compareYearY,
  };
}

function href(current: OperationsReportUrlState, patch: Partial<OperationsReportUrlState>) {
  const next = mergeUrlState(current, patch);
  return `/reports/operations?${operationsReportSearchParamsToUrl(next)}`;
}

function mergeByBucket(
  a: TrendRow[],
  b: TrendRow[],
): Array<{ x: string; count: number; compareCount: number }> {
  const map = new Map<string, { x: string; count: number; compareCount: number }>();
  for (const x of a) {
    map.set(x.bucket, { x: x.bucket, count: x.count, compareCount: 0 });
  }
  for (const x of b) {
    const ex = map.get(x.bucket) ?? { x: x.bucket, count: 0, compareCount: 0 };
    ex.compareCount = x.count;
    map.set(x.bucket, ex);
  }
  return [...map.values()].sort((p, q) => p.x.localeCompare(q.x));
}

function mergeTrendByMonthOfYear(
  a: TrendRow[],
  b: TrendRow[],
): Array<{ x: string; count: number; compareCount: number }> {
  const map = new Map<number, { x: string; count: number; compareCount: number }>();
  for (const t of a) {
    const d = new Date(`${t.bucket}T12:00:00.000Z`);
    const mi = d.getUTCMonth();
    map.set(mi, { x: MONTH_CHART[mi] ?? String(mi + 1), count: t.count, compareCount: 0 });
  }
  for (const t of b) {
    const d = new Date(`${t.bucket}T12:00:00.000Z`);
    const mi = d.getUTCMonth();
    const ex = map.get(mi) ?? { x: MONTH_CHART[mi] ?? String(mi + 1), count: 0, compareCount: 0 };
    ex.compareCount = t.count;
    map.set(mi, ex);
  }
  return [...map.entries()]
    .sort(([ka], [kb]) => ka - kb)
    .map(([, v]) => v);
}

function yearOptions(centerY: number, span = 16): string[] {
  const out: string[] = [];
  for (let i = 0; i < span; i++) out.push(String(centerY - i));
  return out;
}

function formatShares(list: { label: string; percent: number }[], maxLen = 52): string {
  if (!list.length) return "—";
  const s = list.map((x) => `${x.label} ${x.percent}%`).join(" · ");
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

export default function OperationsReportClient(props: {
  primary: ServiceAnalyticsSnapshot;
  compare: ServiceAnalyticsSnapshot | null;
  urlState: OperationsReportUrlState;
}) {
  const { primary, compare, urlState } = props;
  const router = useRouter();
  const nowYm = currentYmUtc();
  const nowY = currentYearUtc();
  const cy = Number(nowY);

  const agentPie = pieData(primary.byAgent.map((r) => ({ label: r.label, count: r.count })));
  const constructionPie = pieData(
    primary.byConstruction.map((r) => ({ label: r.label, count: r.count })),
  );
  const barManu = primary.byManufacturer.slice(0, 12).map((r) => ({ name: r.label, count: r.count }));

  const dPrimary = deltaLabel(primary.totals.serviced, compare?.totals.serviced ?? null);
  const dUp = deltaLabel(primary.totals.upPercent, compare?.totals.upPercent ?? null);

  const lineRows =
    compare && primary.mode === "year" && compare.mode === "year"
      ? mergeTrendByMonthOfYear(primary.byTrend, compare.byTrend)
      : compare
        ? mergeByBucket(primary.byTrend, compare.byTrend)
        : primary.byTrend.map((t) => ({ x: t.bucket, count: t.count }));

  const servicerQuery = operationsReportSearchParamsToUrl(urlState);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Servisna analitika</h1>
          <p className="text-sm text-slate-600">
            Servisirane stavke u odabranom razdoblju (<code className="rounded bg-slate-100 px-1">servicedAt</code>
            ), s označenim unutarnjim pregledom (UP) gdje je{" "}
            <code className="rounded bg-slate-100 px-1">internalDone</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={href(urlState, { mode: "month", monthYm: nowYm, compareMonthYm: null })}
            className={
              "rounded-md border px-3 py-1.5 text-sm font-medium " +
              (urlState.mode === "month" && urlState.monthYm === nowYm
                ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                : "border-slate-200 bg-white hover:bg-slate-50")
            }
          >
            Ovaj mjesec
          </Link>
          <Link
            href={href(urlState, { mode: "month", monthYm: shiftMonthYm(nowYm, -1), compareMonthYm: null })}
            className={
              "rounded-md border px-3 py-1.5 text-sm font-medium " +
              (urlState.mode === "month" && urlState.monthYm === shiftMonthYm(nowYm, -1)
                ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                : "border-slate-200 bg-white hover:bg-slate-50")
            }
          >
            Prošli mjesec
          </Link>
          <Link
            href={href(urlState, { mode: "year", yearY: nowY, compareYearY: String(cy - 1) })}
            className={
              "rounded-md border px-3 py-1.5 text-sm font-medium " +
              (urlState.mode === "year" && urlState.yearY === nowY
                ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                : "border-slate-200 bg-white hover:bg-slate-50")
            }
          >
            Ova godina
          </Link>
          <Link
            href={href(urlState, { mode: "all", compareMonthYm: null, compareYearY: null })}
            className={
              "rounded-md border px-3 py-1.5 text-sm font-medium " +
              (urlState.mode === "all"
                ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                : "border-slate-200 bg-white hover:bg-slate-50")
            }
          >
            Cijelo vrijeme
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          <span className="font-medium text-slate-700">Razdoblje:</span>
          <Link
            href={href(urlState, { mode: "month" })}
            className={
              urlState.mode === "month"
                ? "rounded-full bg-indigo-100 px-3 py-0.5 font-medium text-indigo-900"
                : "rounded-full px-3 py-0.5 text-slate-600 hover:bg-slate-100"
            }
          >
            Mjesec
          </Link>
          <Link
            href={href(urlState, { mode: "year", compareMonthYm: null })}
            className={
              urlState.mode === "year"
                ? "rounded-full bg-indigo-100 px-3 py-0.5 font-medium text-indigo-900"
                : "rounded-full px-3 py-0.5 text-slate-600 hover:bg-slate-100"
            }
          >
            Godina
          </Link>
          <Link
            href={href(urlState, { mode: "all", compareMonthYm: null, compareYearY: null })}
            className={
              urlState.mode === "all"
                ? "rounded-full bg-indigo-100 px-3 py-0.5 font-medium text-indigo-900"
                : "rounded-full px-3 py-0.5 text-slate-600 hover:bg-slate-100"
            }
          >
            Cijelo vrijeme
          </Link>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {urlState.mode === "month" ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Mjesec</span>
                <input
                  type="month"
                  className="input h-9 w-44 text-sm"
                  value={urlState.monthYm}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    const ym = `${v.slice(0, 4)}-${v.slice(5, 7)}`;
                    router.push(href(urlState, { monthYm: ym }));
                  }}
                />
              </label>
              <div className="flex gap-2">
                <Link
                  href={href(urlState, { monthYm: shiftMonthYm(urlState.monthYm, -1) })}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  ← Prethodni
                </Link>
                <Link
                  href={href(urlState, { monthYm: shiftMonthYm(urlState.monthYm, 1) })}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  Sljedeći →
                </Link>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Usporedi s mjesec</span>
                <select
                  className="input h-9 min-w-[200px] text-sm"
                  value={urlState.compareMonthYm ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    router.push(href(urlState, { compareMonthYm: v || null }));
                  }}
                >
                  <option value="">— bez usporedbe —</option>
                  <option value={shiftMonthYm(urlState.monthYm, -1)}>
                    {monthLabelHr(shiftMonthYm(urlState.monthYm, -1))}
                  </option>
                  <option value={shiftMonthYm(urlState.monthYm, -2)}>
                    {monthLabelHr(shiftMonthYm(urlState.monthYm, -2))}
                  </option>
                  <option value={shiftMonthYm(urlState.monthYm, 1)}>
                    {monthLabelHr(shiftMonthYm(urlState.monthYm, 1))}
                  </option>
                  <option value={shiftMonthYm(nowYm, -1)}>{monthLabelHr(shiftMonthYm(nowYm, -1))} (prošli od danas)</option>
                </select>
              </label>
            </>
          ) : null}

          {urlState.mode === "year" ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Godina</span>
                <select
                  className="input h-9 w-32 text-sm"
                  value={urlState.yearY}
                  onChange={(e) => router.push(href(urlState, { yearY: e.target.value }))}
                >
                  {yearOptions(cy).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <Link
                  href={href(urlState, { yearY: String(Number(urlState.yearY) - 1) })}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  ← {Number(urlState.yearY) - 1}
                </Link>
                <Link
                  href={href(urlState, { yearY: String(Number(urlState.yearY) + 1) })}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  {Number(urlState.yearY) + 1} →
                </Link>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Usporedi s godinom</span>
                <select
                  className="input h-9 min-w-[120px] text-sm"
                  value={urlState.compareYearY ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    router.push(href(urlState, { compareYearY: v || null }));
                  }}
                >
                  <option value="">— bez usporedbe —</option>
                  {Array.from({ length: 30 }, (_, i) => String(cy + 1 - i))
                    .filter((y) => y !== urlState.yearY)
                    .map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : null}

          {urlState.mode === "all" ? (
            <p className="text-sm text-slate-600">
              Prikaz svih servisiranih stavki u tvrtki (od najranijeg zapisa do danas). Usporedba razdoblja nije
              dostupna u ovom načinu.
            </p>
          ) : null}
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
          Nema servisiranih stavki u odabranom razdoblju.
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
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          {primary.trendGranularity === "day" ? "Servisirano po danu" : "Servisirano po mjesecu"}
        </h2>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineRows}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              <XAxis dataKey="x" tick={{ fontSize: 11 }} />
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
        {compare && primary.mode === "month" && compare.mode === "month" ? (
          <p className="mt-2 text-xs text-slate-500">
            Usporedba po istom kalendarskom danu u mjesecu (dan bez servisa = 0).
          </p>
        ) : null}
        {compare && primary.mode === "year" && compare.mode === "year" ? (
          <p className="mt-2 text-xs text-slate-500">Usporedba po mjesecima u godini (siječanj–prosinac).</p>
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

      <ManufacturerTable rows={primary.byManufacturer} />

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
        <p className="mb-3 text-xs text-slate-500">
          Klik na ime servisera otvara detaljnu analitiku u istom vremenskom rasponu.
        </p>
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
                  <td className="py-2 pr-3 font-medium text-slate-900">
                    {s.servicerId ? (
                      <Link
                        href={`/reports/operations/servicer/${s.servicerId}?${servicerQuery}`}
                        className="text-indigo-700 hover:underline"
                      >
                        {s.servicerName}
                      </Link>
                    ) : (
                      s.servicerName
                    )}
                  </td>
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

function ManufacturerTable(props: { rows: ServiceAnalyticsSnapshot["byManufacturer"] }) {
  const { rows } = props;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Proizvođač (detalj + UP % + starost + udio medija/izvedbe)</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nema podataka.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                <th className="py-2 pr-3">Naziv</th>
                <th className="py-2 pr-3">Stavke</th>
                <th className="py-2 pr-3">UP (kom)</th>
                <th className="py-2 pr-3">UP %</th>
                <th className="py-2 pr-3">Prosjek starosti (god.)</th>
                <th className="py-2 pr-3">Medij (%)</th>
                <th className="py-2">Izvedba (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="py-2 pr-3 text-slate-800">{r.label}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.count}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.internalDone}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.upPercent}%</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-700">
                    {r.avgDeviceAgeYears == null ? "—" : r.avgDeviceAgeYears}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-600">{formatShares(r.agentSharePct)}</td>
                  <td className="py-2 text-xs text-slate-600">{formatShares(r.constructionSharePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
