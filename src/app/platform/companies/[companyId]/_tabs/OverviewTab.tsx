import { getOverviewStats } from "@/lib/companyDetailStats";
import {
  getCompanyHealthScore,
  healthClassToBadge,
} from "@/lib/companyHealth";
import { Section, KpiTile, fmtDateTime } from "./shared";

export default async function OverviewTab({ companyId }: { companyId: string }) {
  const [stats, health] = await Promise.all([
    getOverviewStats(companyId),
    getCompanyHealthScore(companyId),
  ]);

  return (
    <div className="space-y-4">
      {/* Health summary */}
      {health ? (
        <Section title="Health score">
          <HealthBreakdown health={health} />
        </Section>
      ) : null}

      {/* KPI brojevi */}
      <Section title="Brzi pregled">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="Aparati"
            value={stats.counts.extinguishers}
            hint={`${stats.counts.extinguishersActive} aktivnih · ${stats.counts.extinguishersScrapped} otpisanih`}
          />
          <KpiTile label="Kupci" value={stats.counts.customers} />
          <KpiTile
            label="Nalozi (svi)"
            value={stats.counts.workOrders}
            hint={`Otv ${stats.counts.workOrdersDraft} · U tijeku ${stats.counts.workOrdersInProgress} · Zaklj ${stats.counts.workOrdersLocked}`}
          />
          <KpiTile
            label="Racuni"
            value={stats.counts.invoices}
            tone={stats.counts.invoicesOpen > 0 ? "warning" : "neutral"}
            hint={stats.counts.invoicesOpen > 0 ? `${stats.counts.invoicesOpen} otvorenih` : "Bez otvorenih"}
          />
          <KpiTile
            label="Mailovi (30d)"
            value={stats.counts.emails30d}
            tone={stats.counts.emailsFailed30d > 0 ? "danger" : "success"}
            hint={
              stats.counts.emailsFailed30d > 0
                ? `${stats.counts.emailsFailed30d} neuspjeh`
                : "Sve uspjesno"
            }
          />
          <KpiTile
            label="Racuni"
            value={`${stats.counts.activeAccounts} / ${stats.counts.accounts}`}
            hint="aktivni / ukupno"
          />
          <KpiTile
            label="Zadnja prijava"
            value={
              stats.lastLoginAt ? (
                <span className="text-base font-semibold">{fmtDateTime(stats.lastLoginAt)}</span>
              ) : (
                <span className="text-base text-slate-400">—</span>
              )
            }
            tone={stats.lastLoginAt ? "neutral" : "warning"}
            hint={!stats.lastLoginAt ? "Nitko se nije logirao" : undefined}
          />
        </div>
      </Section>

      <Section title="Trend zadnjih 12 mjeseci">
        <MonthlyTrendChart
          months={stats.trend.months}
          createdSeries={stats.trend.workOrders}
          finishedSeries={stats.trend.workOrdersFinished}
        />
      </Section>

      <Section title="Aparati po statusu">
        <StatusBars rows={stats.extinguisherByStatus} total={stats.counts.extinguishers} />
      </Section>
    </div>
  );
}

// ───────────────────────── sub-komponente ─────────────────────────

function HealthBreakdown({
  health,
}: {
  health: NonNullable<Awaited<ReturnType<typeof getCompanyHealthScore>>>;
}) {
  const badge = healthClassToBadge(health.klass);
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-6 py-4">
        <div className="text-5xl font-bold tabular-nums text-slate-900">{health.score}</div>
        <span
          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badge.badgeClass}`}
        >
          <span aria-hidden="true">{badge.emoji}</span>
          {badge.label}
        </span>
      </div>
      <div>
        {health.reasons.length === 0 ? (
          <p className="text-sm text-emerald-700">
            Sve metrike unutar zdravih granica — nema oduzimanja bodova.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {health.reasons.map((r) => (
              <li
                key={r.key}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-1.5"
              >
                <span className="text-slate-700">{r.label}</span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                  −{r.penalty}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MonthlyTrendChart({
  months,
  createdSeries,
  finishedSeries,
}: {
  months: string[];
  createdSeries: number[];
  finishedSeries: number[];
}) {
  const max = Math.max(1, ...createdSeries, ...finishedSeries);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-sky-500" /> Kreirano
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Zavrseno
        </span>
      </div>
      <div className="flex items-end gap-1.5 h-32">
        {months.map((m, i) => {
          const c = createdSeries[i] ?? 0;
          const f = finishedSeries[i] ?? 0;
          return (
            <div key={m} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-full w-full items-end gap-0.5">
                <div
                  className="flex-1 rounded-t bg-sky-500"
                  style={{ height: `${(c / max) * 100}%` }}
                  title={`${m}: ${c} kreiranih`}
                />
                <div
                  className="flex-1 rounded-t bg-emerald-500"
                  style={{ height: `${(f / max) * 100}%` }}
                  title={`${m}: ${f} zavrsenih`}
                />
              </div>
              <span className="text-[9px] text-slate-500">{m.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBars({
  rows,
  total,
}: {
  rows: { status: string; count: number }[];
  total: number;
}) {
  if (total === 0)
    return <p className="text-sm text-slate-500">Nema aparata u sustavu.</p>;
  const COLOR: Record<string, string> = {
    ACTIVE: "bg-emerald-500",
    SCRAPPED: "bg-slate-400",
    LOST: "bg-amber-500",
  };
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const pct = total > 0 ? (r.count / total) * 100 : 0;
        return (
          <div key={r.status}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">{r.status}</span>
              <span className="tabular-nums text-slate-600">
                {r.count} <span className="text-slate-400">({pct.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded bg-slate-100">
              <div
                className={`h-2 rounded ${COLOR[r.status] ?? "bg-slate-300"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
