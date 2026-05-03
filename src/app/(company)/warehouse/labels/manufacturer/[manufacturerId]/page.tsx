import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { ServiceLabelKind } from "@prisma/client";
import {
  authorizationCodeForKind,
  SERVICE_LABEL_KINDS,
  serviceLabelKindLabel,
} from "@/lib/serviceLabelKind";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export const dynamic = "force-dynamic";

export default async function LabelsManufacturerPage({
  params,
}: {
  params: Promise<{ manufacturerId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { manufacturerId } = await params;

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id: manufacturerId },
    select: { id: true, name: true },
  });
  if (!manufacturer) notFound();

  const [auth, labels, stocks] = await Promise.all([
    prisma.companyManufacturerAuthorization.findUnique({
      where: {
        companyId_manufacturerId: {
          companyId: session.companyId,
          manufacturerId,
        },
      },
    }),
    prisma.serviceLabel.findMany({
      where: { manufacturerId },
      select: { id: true, kind: true },
    }),
    prisma.serviceLabelStock.findMany({
      where: {
        companyId: session.companyId,
        serviceLabel: { manufacturerId },
      },
      select: {
        serviceLabelId: true,
        stockQty: true,
        minStockQty: true,
      },
    }),
  ]);

  const labelByKind = new Map(labels.map((l) => [l.kind, l]));
  const stockByLabel = new Map(stocks.map((s) => [s.serviceLabelId, s]));

  return (
    <main className="space-y-6">
      <div>
        <Link
          href="/warehouse/labels"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
        >
          ← Natrag na servisne naljepnice
        </Link>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Servisne naljepnice / Proizvođač
        </div>
        <h1 className="text-3xl font-bold">{displayManufacturer(manufacturer)}</h1>
        {!auth?.active && (
          <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
            Ovlaštenje nije aktivno — aktivirajte ga u{" "}
            <Link href="/admin/settings/authorizations" className="ml-1 underline">
              Postavke → Ovlaštenja
            </Link>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Naljepnica</th>
              <th className="px-3 py-2">Šifra</th>
              <th className="px-3 py-2 text-right">Stanje</th>
              <th className="px-3 py-2 text-right">Min. zaliha</th>
              <th className="px-3 py-2 text-right">Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {SERVICE_LABEL_KINDS.map((kind) => {
              const label = labelByKind.get(kind);
              if (!label) return null;
              const stock = stockByLabel.get(label.id);
              const qty = stock?.stockQty ?? 0;
              const min = stock?.minStockQty ?? 0;
              const code = authorizationCodeForKind(kind as ServiceLabelKind, auth);
              const cellCls =
                qty < 0
                  ? "text-rose-700 font-bold"
                  : min > 0 && qty <= min
                  ? "text-amber-800 font-semibold"
                  : "text-emerald-800 font-semibold";
              return (
                <tr key={kind} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {serviceLabelKindLabel(kind as ServiceLabelKind)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{code ?? "—"}</td>
                  <td className={"px-3 py-2 text-right tabular-nums " + cellCls}>{qty}</td>
                  <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{min}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/warehouse/labels/parts/${label.id}`}
                        className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline"
                      >
                        Kartica stanja
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
