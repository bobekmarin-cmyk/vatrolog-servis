/**
 * Agregati za platform dashboard: KPI brojevi + 30-dnevni trend bucket-i
 * za male sparkline grafove.
 *
 * Sve queries su read-only i tipizirane. `dailyCounts` vraca tocno 30 elemenata
 * (kronoloski, oldest first), gdje je posljednji = danas. Nedostajuci dani su 0.
 */
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function buildEmptyBuckets(end: Date): { keys: string[]; counts: number[]; dayStartMs: number[] } {
  const todayStart = startOfDayUtc(end).getTime();
  const keys: string[] = [];
  const counts: number[] = [];
  const dayStartMs: number[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    const ms = todayStart - i * DAY_MS;
    const d = new Date(ms);
    keys.push(d.toISOString().slice(0, 10));
    counts.push(0);
    dayStartMs.push(ms);
  }
  return { keys, counts, dayStartMs };
}

function fillFromCreatedAt(
  rows: { createdAt: Date }[],
  buckets: { keys: string[]; counts: number[]; dayStartMs: number[] },
): number[] {
  const oldest = buckets.dayStartMs[0];
  for (const r of rows) {
    const t = r.createdAt.getTime();
    if (t < oldest) continue;
    const idx = Math.floor((t - oldest) / DAY_MS);
    if (idx >= 0 && idx < buckets.counts.length) buckets.counts[idx] += 1;
  }
  return buckets.counts;
}

function fillFromSentAt(
  rows: { sentAt: Date }[],
  buckets: { keys: string[]; counts: number[]; dayStartMs: number[] },
): number[] {
  const oldest = buckets.dayStartMs[0];
  for (const r of rows) {
    const t = r.sentAt.getTime();
    if (t < oldest) continue;
    const idx = Math.floor((t - oldest) / DAY_MS);
    if (idx >= 0 && idx < buckets.counts.length) buckets.counts[idx] += 1;
  }
  return buckets.counts;
}

export type DashboardKpis = {
  // Pipeline / akvizicija
  pendingRequests: number;
  signupsThisMonth: number;
  signupsTrend: number[];
  // Aktivnost / retencija
  totalCompanies: number;
  activeCompanies: number;
  trialCompanies: number;
  expiringSoon: number;
  // Operativa / zdravlje
  emailFailuresMonth: number;
  emailFailuresTrend: number[];
  // Kontekst
  monthStart: Date;
  now: Date;
};

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * DAY_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(Date.now() - TREND_DAYS * DAY_MS);

  const [
    totalCompanies,
    activeCompanies,
    trialCompanies,
    expiringSoon,
    signupsThisMonth,
    emailFailuresMonth,
    pendingRequests,
    recentSignups,
    recentEmailFails,
  ] = await Promise.all([
    prisma.company.count({ where: { deletedAt: null } }),
    prisma.company.count({
      where: {
        deletedAt: null,
        blocked: false,
        OR: [{ activeUntil: null }, { activeUntil: { gte: now } }],
      },
    }),
    prisma.company.count({
      where: {
        deletedAt: null,
        trialEndsAt: { not: null, gte: now },
      },
    }),
    prisma.company.count({
      where: {
        deletedAt: null,
        blocked: false,
        activeUntil: { not: null, gte: now, lte: inSevenDays },
      },
    }),
    prisma.company.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
    prisma.emailLog.count({ where: { status: "FAILED", sentAt: { gte: monthStart } } }),
    prisma.registrationRequest.count({ where: { status: "PENDING" } }),
    prisma.company.findMany({
      where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.emailLog.findMany({
      where: { status: "FAILED", sentAt: { gte: thirtyDaysAgo } },
      select: { sentAt: true },
    }),
  ]);

  const signupsBuckets = buildEmptyBuckets(now);
  const signupsTrend = fillFromCreatedAt(recentSignups, signupsBuckets);

  const failsBuckets = buildEmptyBuckets(now);
  const emailFailuresTrend = fillFromSentAt(recentEmailFails, failsBuckets);

  return {
    pendingRequests,
    signupsThisMonth,
    signupsTrend,
    totalCompanies,
    activeCompanies,
    trialCompanies,
    expiringSoon,
    emailFailuresMonth,
    emailFailuresTrend,
    monthStart,
    now,
  };
}
