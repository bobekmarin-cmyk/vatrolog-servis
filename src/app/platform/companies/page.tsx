import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";

function statusBadge(c: { blocked: boolean; activeUntil: Date | null }) {
  if (c.blocked) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />Blokiran</span>;
  }
  if (c.activeUntil && c.activeUntil < new Date()) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" />Istekla</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />Aktivna</span>;
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function PlatformCompaniesPage() {
  await requirePlatformSession();

  const companies = await prisma.company.findMany({
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
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tvrtke</h1>
        <p className="mt-1 text-sm text-slate-600">Upravljanje tenantima i login računima.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link className="btn btn-primary px-4" href="/platform/companies/new">
          + Nova tvrtka
        </Link>
      </div>

      <section className="surface">
        <div className="surface-header">
          <h2 className="h1">Popis tvrtki</h2>
          <span className="subtle">Ukupno: {companies.length}</span>
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
                <th className="p-3">Kupci</th>
                <th className="p-3">Aparati</th>
                <th className="p-3">Nalozi</th>
                <th className="p-3">Zadnja prijava</th>
                <th className="p-3">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((c) => {
                const lastLogin = c.accounts
                  .map((a) => a.lastLoginAt)
                  .filter(Boolean)
                  .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] as Date | undefined;

                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium">{c.name}</div>
                      {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
                    </td>
                    <td className="p-3 font-mono text-xs">{c.oib}</td>
                    <td className="p-3 font-mono text-xs">{c.serviceCode}</td>
                    <td className="p-3">{statusBadge(c)}</td>
                    <td className="p-3 text-center">{c._count.customers}</td>
                    <td className="p-3 text-center">{c._count.extinguishers}</td>
                    <td className="p-3 text-center">{c._count.workOrders}</td>
                    <td className="p-3 text-xs text-slate-500">{lastLogin ? fmtDate(lastLogin) : "—"}</td>
                    <td className="p-3">
                      <Link className="btn btn-outline h-8 px-3 text-xs" href={`/platform/companies/${c.id}`}>
                        Uredi
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {companies.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={9}>
                    Nema tvrtki.
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
