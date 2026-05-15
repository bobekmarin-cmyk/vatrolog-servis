/**
 * Customer Health Score za platform dashboard.
 *
 * Bod od 0 do 100 koji agregira:
 *   - status pretplate (`activeUntil`, `blocked`)
 *   - posljednji login bilo kojeg AccountUser-a
 *   - 30-dnevnu produktivnost (broj WorkOrder kreiranih u zadnjih 30 dana)
 *   - "freshness" — kad je zadnji workorder ikad kreiran
 *
 * Klasifikacija:
 *   - score >= 80 → "healthy"
 *   - 50–79     → "at-risk"
 *   - < 50      → "critical"
 *
 * Read-only, ne baca. Batch verzija (`getAllCompanyHealthScores`) izbjegava
 * N+1 koristeci `groupBy` agregate. Za 100+ tvrtki bit ce potreban cache, sada
 * je benigno (≤ par desetaka tvrtki).
 */
import { prisma } from "@/lib/prisma";

export type HealthClass = "healthy" | "at-risk" | "critical";

export type HealthReason = {
  key: string;
  label: string;
  penalty: number; // pozitivan broj — koliko je oduzeo bodova
};

export type CompanyHealthScore = {
  companyId: string;
  companyName: string;
  serviceCode: string;
  score: number;
  klass: HealthClass;
  reasons: HealthReason[];
  topReason: HealthReason | null;
  // Sirovi inputi (za debug i potencijalni tooltip):
  inputs: {
    blocked: boolean;
    activeUntil: Date | null;
    lastLoginAt: Date | null;
    workOrdersLast30d: number;
    lastWorkOrderAt: Date | null;
  };
};

const PENALTY = {
  BLOCKED: 40,
  SUBSCRIPTION_EXPIRING: 25, // activeUntil < now + 7d
  SUBSCRIPTION_EXPIRED: 35, // activeUntil < now
  NO_LOGIN_14D: 20,
  NEVER_LOGIN: 25,
  ZERO_WORKORDERS_30D: 15,
  STALE_WORKORDERS: 10, // zadnji workorder stariji od 30d
} as const;

function classify(score: number): HealthClass {
  if (score >= 80) return "healthy";
  if (score >= 50) return "at-risk";
  return "critical";
}

type CompanyInput = {
  id: string;
  name: string;
  serviceCode: string;
  blocked: boolean;
  activeUntil: Date | null;
};

function computeScore(
  c: CompanyInput,
  lastLoginAt: Date | null,
  workOrdersLast30d: number,
  lastWorkOrderAt: Date | null,
  now: Date = new Date(),
): CompanyHealthScore {
  const reasons: HealthReason[] = [];
  let score = 100;

  if (c.blocked) {
    reasons.push({ key: "blocked", label: "Tvrtka je blokirana", penalty: PENALTY.BLOCKED });
    score -= PENALTY.BLOCKED;
  }

  if (c.activeUntil) {
    const d7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (c.activeUntil < now) {
      reasons.push({
        key: "subscription_expired",
        label: "Pretplata istekla",
        penalty: PENALTY.SUBSCRIPTION_EXPIRED,
      });
      score -= PENALTY.SUBSCRIPTION_EXPIRED;
    } else if (c.activeUntil < d7) {
      reasons.push({
        key: "subscription_expiring",
        label: "Pretplata istice u 7 dana",
        penalty: PENALTY.SUBSCRIPTION_EXPIRING,
      });
      score -= PENALTY.SUBSCRIPTION_EXPIRING;
    }
  }

  if (!lastLoginAt) {
    reasons.push({
      key: "never_login",
      label: "Nitko se jos nije logirao",
      penalty: PENALTY.NEVER_LOGIN,
    });
    score -= PENALTY.NEVER_LOGIN;
  } else {
    const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    if (lastLoginAt < d14) {
      reasons.push({
        key: "no_login_14d",
        label: "Nitko nije logiran >14 dana",
        penalty: PENALTY.NO_LOGIN_14D,
      });
      score -= PENALTY.NO_LOGIN_14D;
    }
  }

  if (workOrdersLast30d === 0) {
    reasons.push({
      key: "zero_workorders_30d",
      label: "0 radnih naloga u 30 dana",
      penalty: PENALTY.ZERO_WORKORDERS_30D,
    });
    score -= PENALTY.ZERO_WORKORDERS_30D;
  }

  if (lastWorkOrderAt) {
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (lastWorkOrderAt < d30 && workOrdersLast30d === 0) {
      reasons.push({
        key: "stale_workorders",
        label: "Zadnji radni nalog stariji od 30 dana",
        penalty: PENALTY.STALE_WORKORDERS,
      });
      score -= PENALTY.STALE_WORKORDERS;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const topReason = reasons.length
    ? [...reasons].sort((a, b) => b.penalty - a.penalty)[0]
    : null;

  return {
    companyId: c.id,
    companyName: c.name,
    serviceCode: c.serviceCode,
    score,
    klass: classify(score),
    reasons,
    topReason,
    inputs: {
      blocked: c.blocked,
      activeUntil: c.activeUntil,
      lastLoginAt,
      workOrdersLast30d,
      lastWorkOrderAt,
    },
  };
}

export async function getCompanyHealthScore(
  companyId: string,
): Promise<CompanyHealthScore | null> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, serviceCode: true, blocked: true, activeUntil: true },
  });
  if (!c) return null;

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const since30d = new Date(now.getTime() - 30 * dayMs);

  const [lastLogin, woLast30d, lastWo] = await Promise.all([
    prisma.accountUser.aggregate({
      where: { companyId: c.id },
      _max: { lastLoginAt: true },
    }),
    prisma.workOrder.count({
      where: { companyId: c.id, createdAt: { gte: since30d } },
    }),
    prisma.workOrder.aggregate({
      where: { companyId: c.id },
      _max: { createdAt: true },
    }),
  ]);

  return computeScore(
    c,
    lastLogin._max.lastLoginAt ?? null,
    woLast30d,
    lastWo._max.createdAt ?? null,
    now,
  );
}

/**
 * Batch racunanje za sve tvrtke odjednom. Koristi 3 agregirana upita umjesto N+1.
 */
export async function getAllCompanyHealthScores(): Promise<CompanyHealthScore[]> {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const since30d = new Date(now.getTime() - 30 * dayMs);

  const companies = await prisma.company.findMany({
    select: { id: true, name: true, serviceCode: true, blocked: true, activeUntil: true },
  });
  if (companies.length === 0) return [];

  const [lastLogins, woAggregates, lastWoAggregates] = await Promise.all([
    prisma.accountUser.groupBy({
      by: ["companyId"],
      _max: { lastLoginAt: true },
    }),
    prisma.workOrder.groupBy({
      by: ["companyId"],
      where: { createdAt: { gte: since30d } },
      _count: { _all: true },
    }),
    prisma.workOrder.groupBy({
      by: ["companyId"],
      _max: { createdAt: true },
    }),
  ]);

  const lastLoginByCo = new Map<string, Date | null>();
  for (const r of lastLogins) {
    lastLoginByCo.set(r.companyId, r._max.lastLoginAt ?? null);
  }
  const woCountByCo = new Map<string, number>();
  for (const r of woAggregates) {
    woCountByCo.set(r.companyId, r._count._all);
  }
  const lastWoByCo = new Map<string, Date | null>();
  for (const r of lastWoAggregates) {
    lastWoByCo.set(r.companyId, r._max.createdAt ?? null);
  }

  return companies.map((c) =>
    computeScore(
      c,
      lastLoginByCo.get(c.id) ?? null,
      woCountByCo.get(c.id) ?? 0,
      lastWoByCo.get(c.id) ?? null,
      now,
    ),
  );
}

export function healthClassToBadge(klass: HealthClass): {
  label: string;
  badgeClass: string;
  emoji: string;
} {
  switch (klass) {
    case "healthy":
      return {
        label: "Zdravo",
        badgeClass: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
        emoji: "💚",
      };
    case "at-risk":
      return {
        label: "Rizicno",
        badgeClass: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
        emoji: "⚠️",
      };
    case "critical":
      return {
        label: "Kriticno",
        badgeClass: "bg-red-100 text-red-700 ring-1 ring-red-200",
        emoji: "🚨",
      };
  }
}
