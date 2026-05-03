import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { customerDisplayName } from "@/lib/customerDisplay";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";

const PAGE_SIZE = 25;

export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; customerId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/?forbidden=1");

  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const filterCustomerId = sp.customerId ?? null;

  // Stranica prikazuje samo mail kupcima (customerId IS NOT NULL).
  // Sistemska pošta (pozivnice, reset, setup link) ide adminu tvrtke i ima
  // customerId = null — vidljiva je samo platform/vendor strani u
  // /platform/email-log.
  const whereClause = {
    companyId: session.companyId,
    customerId: filterCustomerId ?? { not: null },
  };

  const [totalCount, filterCustomer] = await Promise.all([
    prisma.emailLog.count({ where: whereClause }),
    filterCustomerId
      ? prisma.customer.findFirst({
          where: { id: filterCustomerId, companyId: session.companyId },
          select: { id: true, name: true, shortName: true },
        })
      : null,
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const logs = await prisma.emailLog.findMany({
    where: whereClause,
    orderBy: { sentAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { customer: true },
  });

  return (
    <main className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Poslana pošta</h1>
          <p className="text-sm text-slate-500">
            Ukupno {totalCount} zapisa
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-outline px-4" href="/reports/monthly">Istek po mjesecima</Link>
          <Link className="btn btn-outline px-4" href="/dashboard">← Dashboard</Link>
        </div>
      </div>

      {filterCustomer && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-sm text-blue-800">
            Filtar: <span className="font-semibold">{filterCustomer.shortName ?? filterCustomer.name}</span>
          </span>
          <Link
            href="/reports/email-log"
            className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Ukloni filtar
          </Link>
        </div>
      )}

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-2">Datum</th>
              <th className="px-4 py-2">Kupac</th>
              <th className="px-4 py-2">Predmet</th>
              <th className="px-4 py-2">Mjesec</th>
              <th className="px-4 py-2 text-right">Kom</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => (
              <tr key={log.id} className="group hover:bg-slate-50/60">
                <td className="px-4 py-2 whitespace-nowrap text-xs">{formatDateDdMmYyyy(log.sentAt)}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{customerDisplayName(log.customer)}</div>
                  <div className="text-xs text-slate-400">{log.toEmail}</div>
                </td>
                <td className="px-4 py-2 max-w-[220px] truncate text-xs" title={log.subject}>{log.subject}</td>
                <td className="px-4 py-2 whitespace-nowrap text-xs">{log.month}</td>
                <td className="px-4 py-2 text-right tabular-nums">{log.itemCount}</td>
                <td className="px-4 py-2">
                  {log.status === "SENT" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Poslano
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800" title={log.error ?? ""}>
                      Greška
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/reports/email-log/${log.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 opacity-0 transition-all group-hover:opacity-100 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Otvori
                  </Link>
                </td>
              </tr>
            ))}

            {logs.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={7}>
                  Nema zapisa o poslanoj pošti.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (() => {
        const qs = filterCustomerId ? `&customerId=${filterCustomerId}` : "";
        return (
          <div className="flex items-center justify-center gap-2">
            {currentPage > 1 && (
              <Link href={`/reports/email-log?page=${currentPage - 1}${qs}`} className="btn btn-outline px-3 py-1 text-xs">
                ← Prethodna
              </Link>
            )}
            <span className="text-sm text-slate-500">
              Stranica {currentPage} od {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link href={`/reports/email-log?page=${currentPage + 1}${qs}`} className="btn btn-outline px-3 py-1 text-xs">
                Sljedeća →
              </Link>
            )}
          </div>
        );
      })()}
    </main>
  );
}
