import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import {
  getAllCompanyHealthScores,
  healthClassToBadge,
  type HealthClass,
} from "@/lib/companyHealth";

export const dynamic = "force-dynamic";

function statusBadge(c: { blocked: boolean; activeUntil: Date | null }) {
  if (c.blocked) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
        Blokiran
      </span>
    );
  }
  if (c.activeUntil && c.activeUntil < new Date()) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
        Istekla
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
      Aktivna
    </span>
  );
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const HEALTH_FILTERS: ReadonlyArray<{
  value: "all" | HealthClass;
  label: string;
}> = [
  { value: "all", label: "Sve" },
  { value: "healthy", label: "Zdravo" },
  { value: "at-risk", label: "Rizicno" },
  { value: "critical", label: "Kriticno" },
];

function parseHealthFilter(raw: string | string[] | undefined): "all" | HealthClass {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "healthy" || v === "at-risk" || v === "critical") return v;
  return "all";
}

export default async function PlatformCompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<{ health?: string | string[]; hardPurge?: string | string[]; name?: string | string[] }>;
}) {
  await requirePlatformSession();

  const sp = (await searchParams) ?? {};
  const healthFilter = parseHealthFilter(sp.health);
  const hardPurge = Array.isArray(sp.hardPurge) ? sp.hardPurge[0] : sp.hardPurge;
  const purgedName = Array.isArray(sp.name) ? sp.name[0] : sp.name;

  const [companies, healthScores] = await Promise.all([
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        accounts: { orderBy: { username: "asc" }, select: { lastLoginAt: true } },
        _count: {
          select: {
            accounts: true,
            customers: true,
            extinguishers: true,
            workOrders: true,
          },
        },
      },
    }),
    getAllCompanyHealthScores(),
  ]);

  const scoreById = new Map(healthScores.map((s) => [s.companyId, s]));

  const filtered =
    healthFilter === "all"
      ? companies
      : companies.filter((c) => scoreById.get(c.id)?.klass === healthFilter);

  const countByClass = healthScores.reduce<Record<HealthClass | "all", number>>(
    (acc, s) => {
      acc.all += 1;
      acc[s.klass] = (acc[s.klass] ?? 0) + 1;
      return acc;
    },
    { all: 0, healthy: 0, "at-risk": 0, critical: 0 },
  );

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tvrtke</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upravljanje tenantima i login računima.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link className="btn btn-primary px-4" href="/platform/companies/new">
          + Nova tvrtka
        </Link>
      </div>

      {hardPurge === "ok" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Tvrtka{purgedName ? ` „${purgedName}”` : ""} je trajno obrisana.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-500 uppercase tracking-wide">Health:</span>
        {HEALTH_FILTERS.map((f) => {
          const active = f.value === healthFilter;
          const href = f.value === "all" ? "/platform/companies" : `/platform/companies?health=${f.value}`;
          const count = countByClass[f.value as keyof typeof countByClass] ?? 0;
          return (
            <Link
              key={f.value}
              href={href}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors " +
                (active
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200")
              }
            >
              {f.label}
              <span
                className={
                  "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums " +
                  (active ? "bg-white/20" : "bg-white/70")
                }
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <section className="surface">
        <div className="surface-header">
          <h2 className="h1">Popis tvrtki</h2>
          <span className="subtle">
            Ukupno: {filtered.length}
            {healthFilter !== "all" ? ` / ${companies.length}` : ""}
          </span>
        </div>
        <div className="h-px bg-black/10" />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-600">
                <th className="p-3">Naziv</th>
                <th className="p-3">OIB</th>
                <th className="p-3">Šifra</th>
                <th className="p-3">Status</th>
                <th className="p-3">Health</th>
                <th className="p-3">Kupci</th>
                <th className="p-3">Aparati</th>
                <th className="p-3">Nalozi</th>
                <th className="p-3">Zadnja prijava</th>
                <th className="p-3">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const lastLogin = c.accounts
                  .map((a) => a.lastLoginAt)
                  .filter(Boolean)
                  .sort(
                    (a, b) => (b as Date).getTime() - (a as Date).getTime(),
                  )[0] as Date | undefined;
                const score = scoreById.get(c.id);
                const badge = score ? healthClassToBadge(score.klass) : null;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium">{c.name}</div>
                      {c.email && (
                        <div className="text-xs text-slate-400">{c.email}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{c.oib}</td>
                    <td className="p-3 font-mono text-xs">{c.serviceCode}</td>
                    <td className="p-3">{statusBadge(c)}</td>
                    <td className="p-3">
                      {score && badge ? (
                        <span
                          title={score.topReason?.label ?? undefined}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badge.badgeClass}`}
                        >
                          {badge.emoji}
                          <span className="tabular-nums">{score.score}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">{c._count.customers}</td>
                    <td className="p-3 text-center">{c._count.extinguishers}</td>
                    <td className="p-3 text-center">{c._count.workOrders}</td>
                    <td className="p-3 text-xs text-slate-500">
                      {lastLogin ? fmtDate(lastLogin) : "—"}
                    </td>
                    <td className="p-3">
                      <Link
                        className="btn btn-outline h-8 px-3 text-xs"
                        href={`/platform/companies/${c.id}`}
                      >
                        Uredi
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={10}>
                    {healthFilter === "all"
                      ? "Nema tvrtki."
                      : `Nema tvrtki u kategoriji "${healthFilter}".`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
