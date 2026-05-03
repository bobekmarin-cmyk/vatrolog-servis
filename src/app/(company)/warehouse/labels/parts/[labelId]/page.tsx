import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import type { ServiceLabelKind } from "@prisma/client";
import {
  authorizationCodeForKind,
  serviceLabelKindLabel,
} from "@/lib/serviceLabelKind";
import AdjustLabelStockButton from "./AdjustLabelStockButton";
import LabelMinStockEditor from "./LabelMinStockEditor";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export const dynamic = "force-dynamic";

type HistoryEntry = {
  id: string;
  date: Date;
  type: "RECEIPT" | "ADJUSTMENT" | "CONSUMPTION";
  delta: number;
  label: string;
  reference: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
  workOrderId: string | null;
  workOrderNumber: string | null;
  actor: string | null;
};

export default async function LabelStockCardPage({
  params,
}: {
  params: Promise<{ labelId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { labelId } = await params;

  const label = await prisma.serviceLabel.findUnique({
    where: { id: labelId },
    include: {
      manufacturer: { select: { id: true, name: true, displayName: true } },
    },
  });
  if (!label) notFound();

  const [stock, auth, receiptItems, adjustments, consumptions] = await Promise.all([
    prisma.serviceLabelStock.findUnique({
      where: {
        companyId_serviceLabelId: {
          companyId: session.companyId,
          serviceLabelId: labelId,
        },
      },
    }),
    prisma.companyManufacturerAuthorization.findUnique({
      where: {
        companyId_manufacturerId: {
          companyId: session.companyId,
          manufacturerId: label.manufacturerId,
        },
      },
    }),
    prisma.serviceLabelReceiptItem.findMany({
      where: {
        serviceLabelId: labelId,
        receipt: { companyId: session.companyId },
      },
      include: {
        receipt: {
          select: {
            id: true,
            number: true,
            receiptDate: true,
            supplierName: true,
            reference: true,
            createdBy: { select: { username: true, email: true } },
          },
        },
      },
    }),
    prisma.serviceLabelAdjustment.findMany({
      where: { serviceLabelId: labelId, companyId: session.companyId },
      include: { createdBy: { select: { username: true, email: true } } },
    }),
    prisma.workOrderLabelConsumption.findMany({
      where: {
        serviceLabelId: labelId,
        workOrder: { companyId: session.companyId },
      },
      include: {
        workOrder: {
          select: { id: true, orderNumber: true, lockedAt: true },
        },
      },
    }),
  ]);

  const stockQty = stock?.stockQty ?? 0;
  const minStockQty = stock?.minStockQty ?? 0;
  const code = authorizationCodeForKind(label.kind as ServiceLabelKind, auth);

  const history: HistoryEntry[] = [
    ...receiptItems.map<HistoryEntry>((ri) => ({
      id: ri.id,
      date: ri.receipt.receiptDate,
      type: "RECEIPT",
      delta: ri.quantity,
      label: `Primka MUP-a (${ri.receipt.number})`,
      reference: ri.receipt.reference,
      receiptId: ri.receipt.id,
      receiptNumber: ri.receipt.number,
      workOrderId: null,
      workOrderNumber: null,
      actor: ri.receipt.createdBy?.username ?? ri.receipt.createdBy?.email ?? null,
    })),
    ...adjustments.map<HistoryEntry>((a) => ({
      id: a.id,
      date: a.createdAt,
      type: "ADJUSTMENT",
      delta: a.delta,
      label: `Korekcija: ${a.reason}`,
      reference: null,
      receiptId: null,
      receiptNumber: null,
      workOrderId: null,
      workOrderNumber: null,
      actor: a.createdBy?.username ?? a.createdBy?.email ?? null,
    })),
    ...consumptions.map<HistoryEntry>((c) => ({
      id: `${c.workOrderId}-${c.serviceLabelId}`,
      date: c.createdAt,
      type: "CONSUMPTION",
      delta: -c.quantity,
      label: `Potrošnja — zaključan radni nalog`,
      reference: null,
      receiptId: null,
      receiptNumber: null,
      workOrderId: c.workOrder.id,
      workOrderNumber: c.workOrder.orderNumber,
      actor: null,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const isLow = minStockQty > 0 && stockQty <= minStockQty;
  const isNegative = stockQty < 0;

  return (
    <main className="space-y-6">
      <div>
        <Link
          href={`/warehouse/labels/manufacturer/${label.manufacturer.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
        >
          ← Natrag na proizvođača
        </Link>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          <Link href="/warehouse/labels" className="hover:underline">
            Servisne naljepnice
          </Link>{" "}
          /{" "}
          <Link
            href={`/warehouse/labels/manufacturer/${label.manufacturer.id}`}
            className="hover:underline"
          >
            {displayManufacturer(label.manufacturer)}
          </Link>{" "}
          / Kartica stanja
        </div>
        <h1 className="text-3xl font-bold">
          {serviceLabelKindLabel(label.kind as ServiceLabelKind)}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Šifra: <span className="font-mono">{code ?? "—"}</span> · Proizvođač:{" "}
          {displayManufacturer(label.manufacturer)}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div
          className={`rounded-xl border p-5 ${
            isNegative
              ? "border-rose-200 bg-rose-50"
              : isLow
              ? "border-amber-200 bg-amber-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-slate-500">Trenutno stanje</div>
          <div
            className={`mt-1 text-4xl font-bold tabular-nums ${
              isNegative ? "text-rose-700" : isLow ? "text-amber-700" : "text-slate-900"
            }`}
          >
            {stockQty}
          </div>
          {isNegative && <div className="mt-1 text-xs text-rose-700">Stanje je negativno.</div>}
          {!isNegative && isLow && (
            <div className="mt-1 text-xs text-amber-700">Ispod minimuma.</div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Minimalna zaliha</div>
          <LabelMinStockEditor serviceLabelId={label.id} initial={minStockQty} />
          <div className="mt-2 text-xs text-slate-500">Postavite 0 za „bez upozorenja“.</div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Akcije</div>
          <AdjustLabelStockButton serviceLabelId={label.id} />
          <Link
            href={`/warehouse/labels/receipts/new?labelId=${label.id}`}
            className="btn btn-outline h-10 text-center"
          >
            + Nova primka s ovom naljepnicom
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Povijest</h2>
        <p className="text-xs text-slate-500">
          Primke, ručne korekcije i potrošnja pri zaključavanju radnih naloga.
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">Tip</th>
                <th className="px-3 py-2 text-right">Količina</th>
                <th className="px-3 py-2">Opis</th>
                <th className="px-3 py-2">Referenca</th>
                <th className="px-3 py-2">Dokument</th>
                <th className="px-3 py-2">Unio</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((h) => (
                <tr key={`${h.type}-${h.id}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateDdMmYyyy(h.date)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        h.type === "RECEIPT"
                          ? "bg-emerald-100 text-emerald-900"
                          : h.type === "CONSUMPTION"
                          ? "bg-rose-100 text-rose-900"
                          : "bg-sky-100 text-sky-900"
                      }`}
                    >
                      {h.type === "RECEIPT"
                        ? "Primka"
                        : h.type === "CONSUMPTION"
                        ? "Potrošnja"
                        : "Korekcija"}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold tabular-nums ${
                      h.delta < 0 ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {h.delta > 0 ? `+${h.delta}` : h.delta}
                  </td>
                  <td className="px-3 py-2">{h.label}</td>
                  <td className="px-3 py-2 text-slate-600">{h.reference ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {h.receiptId ? (
                      <Link
                        href={`/warehouse/labels/receipts/${h.receiptId}`}
                        className="hover:underline"
                      >
                        {h.receiptNumber}
                      </Link>
                    ) : h.workOrderId ? (
                      <Link href={`/work-orders/${h.workOrderId}`} className="hover:underline">
                        {h.workOrderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{h.actor ?? "—"}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    Još nema ulaza za ovu naljepnicu.
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
