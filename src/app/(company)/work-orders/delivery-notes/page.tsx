import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { customerDisplayName } from "@/lib/customerDisplay";

export const metadata = {
  title: "Otpremnice",
};

export default async function DeliveryNotesRegistryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { name: true, serviceCode: true, deliveryNoteNumberPrefix: true },
  });
  if (!company) notFound();

  const notes = await prisma.deliveryNote.findMany({
    where: { companyId: session.companyId },
    orderBy: { issuedAt: "desc" },
    take: 1000,
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customer: { select: { name: true, shortName: true } },
        },
      },
      issuedByAccountUser: { select: { username: true } },
    },
  });

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Evidencija otpremnica</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tvrtka: {company.name} · prefiks broja:{" "}
            <span className="font-mono">
              {(company.deliveryNoteNumberPrefix?.trim() || "auto iz šifre servisa").toString()}
            </span>{" "}
            ({company.serviceCode})
          </p>
        </div>
        <Link className="btn btn-outline px-4" href="/work-orders">
          ← Radni nalozi
        </Link>
      </div>

      <section className="surface overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Broj otpremnice</th>
              <th className="px-3 py-2">Datum izdavanja</th>
              <th className="px-3 py-2">Radni nalog</th>
              <th className="px-3 py-2">Kupac</th>
              <th className="px-3 py-2">Izdao</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {notes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Još nema izdanih otpremnica.
                </td>
              </tr>
            ) : (
              notes.map((n) => {
                const cust = n.workOrder.customer;
                const status =
                  n.pdfStoragePath === null
                    ? "U obradi"
                    : n.supersededAt
                      ? "Zamijenjena"
                      : "Aktivna";
                return (
                  <tr key={n.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-mono font-medium text-slate-900">{n.number}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                      {formatDateDdMmYyyy(n.issuedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        className="font-mono text-red-700 hover:underline"
                        href={`/work-orders/${n.workOrder.id}`}
                      >
                        {n.workOrder.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 max-w-[220px] truncate" title={customerDisplayName(cust)}>
                      {customerDisplayName(cust)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {n.issuedByAccountUser?.username ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          status === "Aktivna"
                            ? "badge badge-success badge-tight"
                            : status === "Zamijenjena"
                              ? "badge badge-neutral badge-tight"
                              : "badge badge-warning badge-tight"
                        }
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
