import Link from "next/link";
import { requirePlatformSession } from "@/lib/platformAuth";
import { getRecentPlatformActivity } from "@/lib/auditLog";
import { getAllCompanyHealthScores } from "@/lib/companyHealth";
import { logError } from "@/lib/logger";
import { getDashboardKpis, type DashboardKpis } from "./_dashboard/getDashboardKpis";
import { getPlatformHealth } from "./_dashboard/getPlatformHealth";
import { HealthStrip } from "./_dashboard/HealthStrip";
import { QuickActions } from "./_dashboard/QuickActions";
import { KpiGroups } from "./_dashboard/KpiGroups";
import { RecentActivityFeed } from "./_dashboard/RecentActivityFeed";
import { RiskView } from "./_dashboard/RiskView";
import { OperationalFocus } from "./_dashboard/OperationalFocus";

/** Bez DB na buildu — ne pokušavaj statički prerender (npr. Railway/CI bez DATABASE_URL). */
export const dynamic = "force-dynamic";

/**
 * Dashboard skuplja podatke iz više nezavisnih izvora. Ako jedan zakaže
 * (npr. prekid prema bazi), stranica mora prikazati ostalo umjesto da cijeli
 * `/platform` padne na "server-side exception".
 */
async function safeLoad<T>(event: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (err) {
    logError(event, err);
    return fallback;
  }
}

const EMPTY_KPIS: DashboardKpis = {
  pendingRequests: 0,
  signupsThisMonth: 0,
  signupsTrend: [],
  totalCompanies: 0,
  activeCompanies: 0,
  trialCompanies: 0,
  expiringSoon: 0,
  emailFailuresMonth: 0,
  emailFailuresTrend: [],
  monthStart: new Date(),
  now: new Date(),
};

export default async function PlatformIndexPage() {
  await requirePlatformSession();

  const [kpis, health, activity, healthScores] = await Promise.all([
    safeLoad("platform_dashboard_kpis_failed", getDashboardKpis, EMPTY_KPIS),
    safeLoad("platform_dashboard_health_failed", getPlatformHealth, []),
    safeLoad("platform_dashboard_activity_failed", () => getRecentPlatformActivity(15), []),
    safeLoad("platform_dashboard_scores_failed", getAllCompanyHealthScores, []),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Platform dashboard</h1>
          <p className="text-sm text-slate-600">
            Brzi pregled SaaS operacija prije i nakon launch-a.
          </p>
        </div>
        <Link href="/platform/companies" className="btn btn-primary">
          Upravljaj tvrtkama
        </Link>
      </div>

      <HealthStrip items={health} />

      <QuickActions />

      <KpiGroups kpis={kpis} />

      <RiskView scores={healthScores} limit={5} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivityFeed entries={activity} />
        <OperationalFocus kpis={kpis} health={health} />
      </div>
    </div>
  );
}
