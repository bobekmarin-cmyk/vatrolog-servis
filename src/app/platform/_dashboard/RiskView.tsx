import Link from "next/link";
import type { CompanyHealthScore } from "@/lib/companyHealth";
import { healthClassToBadge } from "@/lib/companyHealth";

/**
 * "Risk view" sekcija: prikazuje top N at-risk i critical tvrtki sortirano
 * po score-u rastuce (najgori prvi). Empty state ako su sve healthy.
 */
export function RiskView({
  scores,
  limit = 5,
}: {
  scores: CompanyHealthScore[];
  limit?: number;
}) {
  const atRisk = scores
    .filter((s) => s.klass !== "healthy")
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);

  if (atRisk.length === 0) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-base font-semibold text-emerald-900">
          Sve tvrtke su u zdravoj zoni ✓
        </h2>
        <p className="mt-1 text-sm text-emerald-700">
          {scores.length === 0
            ? "Nema tvrtki za pratiti — registracije će se pojaviti čim prvi tenant uđe."
            : `${scores.length} ${scores.length === 1 ? "tvrtka" : "tvrtki"} ima zdrav score (≥ 80).`}
        </p>
      </section>
    );
  }

  const criticalCount = atRisk.filter((s) => s.klass === "critical").length;
  const atRiskCount = atRisk.filter((s) => s.klass === "at-risk").length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div>
          <h2 className="text-base font-semibold">Tvrtke koje treba pratiti</h2>
          <p className="text-xs text-slate-500">
            {criticalCount > 0
              ? `${criticalCount} kriticna · ${atRiskCount} rizicna`
              : `${atRiskCount} rizicna`}
            {scores.length > atRisk.length
              ? ` · od ${scores.length} ukupno`
              : null}
          </p>
        </div>
        <Link
          href="/platform/companies?health=at-risk"
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          Sve rizicne →
        </Link>
      </div>
      <ul className="divide-y divide-slate-100">
        {atRisk.map((s) => {
          const badge = healthClassToBadge(s.klass);
          return (
            <li key={s.companyId} className="flex items-center gap-3 px-5 py-3">
              <span className="font-mono text-xs text-slate-400 w-8 shrink-0 tabular-nums">
                {s.score}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badge.badgeClass}`}
              >
                <span aria-hidden="true">{badge.emoji}</span>
                {badge.label}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/platform/companies/${s.companyId}`}
                  className="block truncate text-sm font-medium text-slate-900 hover:text-slate-700"
                >
                  {s.companyName}
                </Link>
                <div className="truncate text-xs text-slate-500">
                  {s.topReason?.label ?? "Bez ocitog razloga"}
                  {s.serviceCode ? (
                    <span className="ml-2 text-slate-400">· {s.serviceCode}</span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
