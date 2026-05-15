import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import type { ServiceLabelKind } from "@prisma/client";
import { serviceLabelKindLabel } from "@/lib/serviceLabelKind";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export const dynamic = "force-dynamic";

export default async function LabelReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const receipt = await prisma.serviceLabelReceipt.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      createdBy: { select: { username: true, email: true } },
      items: {
        include: {
          serviceLabel: {
            include: {
              manufacturer: {
                select: { id: true, name: true, displayName: true, sortOrder: true },
              },
            },
          },
        },
      },
    },
  });
  if (!receipt) notFound();

  const items = [...receipt.items].sort((a, b) => {
    const so =
      (a.serviceLabel.manufacturer.sortOrder ?? 0) -
      (b.serviceLabel.manufacturer.sortOrder ?? 0);
    if (so !== 0) return so;
    const n = displayManufacturer(a.serviceLabel.manufacturer).localeCompare(
      displayManufacturer(b.serviceLabel.manufacturer),
      "hr",
    );
    if (n !== 0) return n;
    return a.serviceLabel.kind.localeCompare(b.serviceLabel.kind);
  });

  const totalQty = receipt.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/warehouse/labels/receipts"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
        >
          ← Natrag na popis primki
        </Link>
        <Link
          href="/warehouse/labels"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 hover:underline"
        >
          Servisne naljepnice →
        </Link>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          <Link href="/warehouse/labels" className="hover:underline">
            Servisne naljepnice
          </Link>{" "}
          /{" "}
          <Link href="/warehouse/labels/receipts" className="hover:underline">
            Primke
          </Link>{" "}
          / Detalj
        </div>
        <h1 className="text-3xl font-bold">Primka {receipt.number}</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoBox label="Datum" value={formatDateDdMmYyyy(receipt.receiptDate)} />
        <InfoBox label="Referenca" value={receipt.reference ?? "—"} />
        <InfoBox
          label="Unio"
          value={receipt.createdBy?.username ?? receipt.createdBy?.email ?? "—"}
        />
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
                <th className="px-3 py-2">Naljepnica</th>
                <th className="px-3 py-2 text-right">Količina</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2">{displayManufacturer(i.serviceLabel.manufacturer)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/warehouse/labels/parts/${i.serviceLabel.id}`}
                      className="hover:underline"
                    >
                      {serviceLabelKindLabel(i.serviceLabel.kind as ServiceLabelKind)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.quantity}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr className="font-semibold">
                <td colSpan={2} className="px-3 py-2 text-right">
                  Ukupno
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{totalQty}</td>
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
