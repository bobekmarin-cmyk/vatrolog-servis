import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export const dynamic = "force-dynamic";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const receipt = await prisma.stockReceipt.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      createdBy: { select: { username: true, email: true } },
      items: {
        include: {
          part: {
            include: { manufacturer: { select: { id: true, name: true, displayName: true } } },
          },
        },
        orderBy: [{ part: { manufacturer: { name: "asc" } } }, { part: { name: "asc" } }],
      },
    },
  });
  if (!receipt) notFound();

  const totalQty = receipt.items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = receipt.items.reduce((s, i) => {
    const unit = i.unitPrice ? Number(i.unitPrice) : 0;
    return s + unit * i.quantity;
  }, 0);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/warehouse/receipts"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
        >
          ← Natrag na popis primki
        </Link>
        <Link
          href="/warehouse/parts"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 hover:underline"
        >
          Skladište dijelova →
        </Link>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          <Link href="/warehouse/parts" className="hover:underline">
            Skladište dijelova
          </Link>{" "}
          /{" "}
          <Link href="/warehouse/receipts" className="hover:underline">
            Primke
          </Link>{" "}
          / Detalj
        </div>
        <h1 className="text-3xl font-bold">Primka {receipt.number}</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <InfoBox label="Datum" value={formatDateDdMmYyyy(receipt.receiptDate)} />
        <InfoBox label="Dobavljač" value={receipt.supplierName} />
        <InfoBox label="Referenca" value={receipt.reference ?? "—"} />
        <InfoBox label="Unio" value={receipt.createdBy?.username ?? receipt.createdBy?.email ?? "—"} />
      </div>

      {receipt.note && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Napomena</div>
          <div className="whitespace-pre-wrap">{receipt.note}</div>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">
          Stavke ({receipt.items.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Proizvođač</th>
                <th className="px-3 py-2">Šifra</th>
                <th className="px-3 py-2">Naziv</th>
                <th className="px-3 py-2 text-right">Količina</th>
                <th className="px-3 py-2 text-right">Jed. cijena</th>
                <th className="px-3 py-2 text-right">Ukupno</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {receipt.items.map((i) => {
                const unit = i.unitPrice ? Number(i.unitPrice) : null;
                const line = unit != null ? unit * i.quantity : null;
                return (
                  <tr key={i.id}>
                    <td className="px-3 py-2">{displayManufacturer(i.part.manufacturer)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{i.part.code}</td>
                    <td className="px-3 py-2">
                      <Link href={`/warehouse/parts/${i.part.id}`} className="hover:underline">
                        {i.part.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {unit != null ? unit.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {line != null ? line.toFixed(2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr className="font-semibold">
                <td colSpan={3} className="px-3 py-2 text-right">
                  Ukupno
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{totalQty}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totalAmount > 0 ? totalAmount.toFixed(2) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}
