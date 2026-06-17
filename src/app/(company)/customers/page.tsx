import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Pagination from "@/components/Pagination";
import EmptyState from "@/components/EmptyState";

const PAGE_SIZE = 100;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; q?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { created, q, page: pageStr } = await searchParams;
  const query = (q ?? "").trim();
  const pageNum = Math.max(1, Number.parseInt(pageStr ?? "1", 10) || 1);

  const where = {
    companyId: session.companyId,
    deletedAt: null,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { shortName: { contains: query, mode: "insensitive" as const } },
            { oib: { contains: query } },
            { address: { contains: query, mode: "insensitive" as const } },
            { city: { contains: query, mode: "insensitive" as const } },
            { contactPerson: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { departments: true } }, ownerLink: { select: { status: true } } },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  // Cross-serviser: koji od OIB-a na ovoj stranici već imaju aktivan portal kod
  // DRUGOG servisera (pa se mogu podijeliti).
  const pageOibs = customers.map((c) => c.oib);
  const externalActive = pageOibs.length
    ? await prisma.ownerCustomerLink.findMany({
        where: { status: "ACTIVE", companyId: { not: session.companyId }, customer: { oib: { in: pageOibs } } },
        select: { customer: { select: { oib: true } } },
      })
    : [];
  const externalPortalOibs = new Set(externalActive.map((l) => l.customer.oib));

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Kupci</h1>
        <Link className="btn btn-primary px-4" href="/customers/new">
          + Novi kupac
        </Link>
      </div>

      <form className="flex flex-wrap items-center justify-end gap-2" method="get">
        <input
          name="q"
          className="input h-9 w-[220px] sm:w-[280px] lg:w-[340px]"
          defaultValue={query}
          placeholder="Pretraži: naziv, adresa, OIB ili kontakt..."
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary h-9 w-9 p-0 text-base leading-none" title="Traži" aria-label="Traži">
          🔍
        </button>
        <Link
          href="/customers"
          className="btn btn-outline h-9 w-9 p-0 text-base leading-none"
          title="Očisti"
          aria-label="Očisti"
        >
          ✕
        </Link>
      </form>

      {created ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Kupac uspješno spremljen.
        </div>
      ) : null}

      <section className="surface">
        <Pagination
          basePath="/customers"
          params={{ q: query }}
          page={pageNum}
          pageSize={PAGE_SIZE}
          total={total}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-2 py-2">Naziv</th>
              <th className="px-2 py-2">OIB</th>
              <th className="px-2 py-2">Adresa</th>
              <th className="px-2 py-2">Kontakt</th>
              <th className="px-2 py-2">Odj.</th>
              <th className="px-2 py-2">Portal</th>
              <th className="px-2 py-2 text-right">Akcija</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.map((c) => (
              <tr key={c.id} className="whitespace-nowrap hover:bg-gray-50">
                <td className="max-w-[180px] truncate px-2 py-2 font-medium" title={c.shortName ?? c.name}>
                  {c.shortName ?? c.name}
                </td>
                <td className="px-2 py-2 font-mono">{c.oib}</td>
                <td className="max-w-[220px] truncate px-2 py-2" title={c.address}>
                  {c.address}
                </td>
                <td className="max-w-[220px] truncate px-2 py-2" title={[c.contactPerson, c.phone, c.email].filter(Boolean).join(" · ")}>
                  {[c.contactPerson, c.phone, c.email].filter(Boolean).join(" · ") || "-"}
                </td>
                <td className="px-2 py-2">{c._count.departments}</td>
                <td className="px-2 py-2">
                  {c.ownerLink?.status === "ACTIVE" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Aktivan</span>
                  ) : c.ownerLink?.status === "PENDING_INVITE" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Pozvan</span>
                  ) : externalPortalOibs.has(c.oib) ? (
                    <Link
                      href={`/customers/${c.id}`}
                      className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-200"
                      title="Ovaj kupac već koristi portal kod drugog servisa — možete podijeliti svoje aparate."
                    >
                      Dostupno
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      href={`/customers/${c.id}/analytics`}
                      title="Analitika"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </Link>
                    <Link
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                      href={`/reports/email-log?customerId=${c.id}`}
                      title="Poslana pošta"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </Link>
                    <Link
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                      href={`/customers/${c.id}`}
                      title="Uredi"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}

            {customers.length === 0 && (
              <tr>
                <td className="p-0" colSpan={7}>
                  {query ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-500">
                      Nema kupaca koji odgovaraju pretrazi <b>{query}</b>.{" "}
                      <Link href="/customers" className="text-blue-600 hover:underline">
                        Očisti filter
                      </Link>
                      .
                    </div>
                  ) : (
                    <EmptyState
                      icon="🏢"
                      title="Još nema kupaca."
                      description="Dodajte prvog kupca da biste mogli otvoriti radne naloge i voditi evidenciju aparata."
                      actions={[
                        { href: "/customers/new", label: "+ Novi kupac", primary: true },
                        { href: "/work-orders/new", label: "Otvori radni nalog" },
                      ]}
                      hint="Iz radnog naloga možete odmah dodati novog kupca i njegove aparate."
                    />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <Pagination
          basePath="/customers"
          params={{ q: query }}
          page={pageNum}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </section>
    </main>
  );
}

