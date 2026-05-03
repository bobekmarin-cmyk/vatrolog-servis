import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";

export const dynamic = "force-dynamic";

export default async function LabelReceiptsListPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const receipts = await prisma.serviceLabelReceipt.findMany({
    where: { companyId: session.companyId },
    orderBy: { receiptDate: "desc" },
    include: {
      _count: { select: { items: true } },
      items: { select: { quantity: true } },
      createdBy: { select: { username: true, email: true } },
    },
    take: 200,
  });

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            <Link href="/warehouse/labels" className="hover:underline">
              Servisne naljepnice
            </Link>{" "}
            / Primke
          </div>
          <h1 className="text-3xl font-bold">Primke naljepnica</h1>
          <p className="mt-1 text-sm text-slate-600">
            Popis svih ulaznih dokumenata za servisne naljepnice.
          </p>
        </div>
        <Link href="/warehouse/labels/receipts/new" className="btn btn-primary h-10">
          + Nova primka
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Broj</th>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">Referenca</th>
                <th className="px-3 py-2 text-right">Stavki</th>
                <th className="px-3 py-2 text-right">Ukupno kom.</th>
                <th className="px-3 py-2">Unio</th>
                <th className="px-3 py-2 text-right">Detalj</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {receipts.map((r) => {
                const totalQty = r.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{r.number}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateDdMmYyyy(r.receiptDate)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.reference ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r._count.items}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{totalQty}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.createdBy?.username ?? r.createdBy?.email ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/warehouse/labels/receipts/${r.id}`}
                        className="text-xs font-medium text-slate-700 hover:underline"
                      >
                        Otvori →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {receipts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    Još nema primki naljepnica.
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
