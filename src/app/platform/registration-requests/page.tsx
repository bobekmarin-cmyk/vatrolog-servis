import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Na pregledu", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  APPROVED: {
    label: "Odobreno (čeka kreaciju)",
    tone: "bg-blue-50 text-blue-800 border-blue-200",
  },
  REJECTED: { label: "Odbijeno", tone: "bg-rose-50 text-rose-800 border-rose-200" },
  CONVERTED: {
    label: "Odobreno",
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
};

export const dynamic = "force-dynamic";

export default async function RegistrationRequestsListPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requirePlatformSession();
  const sp = (await searchParams) ?? {};
  const requestedStatus = sp.status?.toUpperCase();
  const filterStatus =
    requestedStatus && STATUS_LABEL[requestedStatus] ? requestedStatus : null;

  const [requests, counts] = await Promise.all([
    prisma.registrationRequest.findMany({
      where: filterStatus ? { status: filterStatus as never } : undefined,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.registrationRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countByStatus: Record<string, number> = {};
  for (const c of counts) {
    countByStatus[c.status] = c._count._all;
  }

  const tabs: { key: string | null; label: string; count: number }[] = [
    {
      key: null,
      label: "Svi",
      count: Object.values(countByStatus).reduce((s, n) => s + n, 0),
    },
    { key: "PENDING", label: "Na pregledu", count: countByStatus.PENDING ?? 0 },
    {
      key: "CONVERTED",
      label: "Odobreno",
      count: (countByStatus.CONVERTED ?? 0) + (countByStatus.APPROVED ?? 0),
    },
    { key: "REJECTED", label: "Odbijeno", count: countByStatus.REJECTED ?? 0 },
  ];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Zahtjevi za probni pristup</h1>
        <p className="mt-1 text-sm text-slate-600">
          Svaki javni zahtjev s formulara čeka ručno odobrenje. Po odobrenju
          kreiramo tvrtku i šaljemo onboarding pozivnicu.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = (t.key ?? "ALL") === (filterStatus ?? "ALL");
          const href = t.key
            ? `/platform/registration-requests?status=${t.key}`
            : `/platform/registration-requests`;
          return (
            <Link
              key={t.key ?? "ALL"}
              href={href}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums ${
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {t.count}
              </span>
            </Link>
          );
        })}
      </div>

      <section className="surface">
        <div className="surface-header">
          <h2 className="h1">Popis zahtjeva</h2>
          <span className="subtle">Prikaz: {requests.length}</span>
        </div>
        <div className="h-px bg-black/10" />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-600">
                <th className="p-3">Zaprimljen</th>
                <th className="p-3">Subjekt</th>
                <th className="p-3">OIB</th>
                <th className="p-3">Kontakt</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((r) => {
                const statusInfo = STATUS_LABEL[r.status] ?? {
                  label: r.status,
                  tone: "bg-slate-50 text-slate-700 border-slate-200",
                };
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-3 text-xs text-slate-600">{fmtDate(r.createdAt)}</td>
                    <td className="p-3">
                      <div className="font-medium">{r.companyName}</div>
                      <div className="text-xs text-slate-500">
                        {r.city}
                        {r.postalCode ? `, ${r.postalCode}` : ""}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{r.oib}</td>
                    <td className="p-3 text-xs">
                      <div>{r.contactEmail}</div>
                      {r.contactPhone && (
                        <div className="text-slate-500">{r.contactPhone}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusInfo.tone}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/platform/registration-requests/${r.id}`}
                        className="btn btn-outline h-8 px-3 text-xs"
                      >
                        Otvori
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {requests.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={6}>
                    Nema zahtjeva u ovoj kategoriji.
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
