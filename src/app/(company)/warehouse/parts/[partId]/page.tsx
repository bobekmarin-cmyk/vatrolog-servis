import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import AdjustStockButton from "./AdjustStockButton";
import MinStockEditor from "./MinStockEditor";
import BackButton from "./BackButton";
import VisibilityToggle from "./VisibilityToggle";
import DeleteCustomPartButton from "./DeleteCustomPartButton";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export const dynamic = "force-dynamic";

type HistoryEntry = {
  id: string;
  date: Date;
  type: "RECEIPT" | "ADJUSTMENT";
  delta: number;
  label: string;
  reference: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
  actor: string | null;
};

export default async function PartStockCardPage({
  params,
}: {
  params: Promise<{ partId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { partId } = await params;

  const part = await prisma.part.findFirst({
    where: {
      id: partId,
      OR: [{ companyId: null }, { companyId: session.companyId }],
    },
    include: {
      manufacturer: { select: { id: true, name: true, displayName: true } },
      stocks: { where: { companyId: session.companyId } },
    },
  });
  if (!part) notFound();

  const stock = part.stocks[0];
  const stockQty = stock?.stockQty ?? 0;
  const minStockQty = stock?.minStockQty ?? 0;
  const isHidden = stock?.hidden ?? false;
  const isCustom = part.companyId === session.companyId;

  const [receiptItems, adjustments] = await Promise.all([
    prisma.stockReceiptItem.findMany({
      where: { partId, receipt: { companyId: session.companyId } },
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
    prisma.stockAdjustment.findMany({
      where: { partId, companyId: session.companyId },
      include: { createdBy: { select: { username: true, email: true } } },
    }),
  ]);

  const history: HistoryEntry[] = [
    ...receiptItems.map<HistoryEntry>((ri) => ({
      id: ri.id,
      date: ri.receipt.receiptDate,
      type: "RECEIPT",
      delta: ri.quantity,
      label: `Primka: ${ri.receipt.supplierName}`,
      reference: ri.receipt.reference,
      receiptId: ri.receipt.id,
      receiptNumber: ri.receipt.number,
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
      actor: a.createdBy?.username ?? a.createdBy?.email ?? null,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const isLow = stock ? minStockQty > 0 && stockQty <= minStockQty : false;
  const isNegative = stockQty < 0;

  return (
    <main className="space-y-6">
      <div>
        <BackButton fallbackHref={`/warehouse/manufacturer/${part.manufacturer.id}`} />
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          <Link href="/warehouse/parts" className="hover:underline">
            Skladište dijelova
          </Link>{" "}
          /{" "}
          <Link href={`/warehouse/manufacturer/${part.manufacturer.id}`} className="hover:underline">
            {displayManufacturer(part.manufacturer)}
          </Link>{" "}
          / Kartica stanja
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{part.name}</h1>
          {isCustom && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
              Vlastiti dio
            </span>
          )}
          {isHidden && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
              Neaktivan
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Šifra: <span className="font-mono">{part.code}</span> · Proizvođač: {displayManufacturer(part.manufacturer)}
        </p>
      </div>

      {/* Stanje */}
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
          {!isNegative && isLow && <div className="mt-1 text-xs text-amber-700">Ispod minimuma.</div>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Minimalna zaliha</div>
          <MinStockEditor partId={part.id} initial={minStockQty} />
          <div className="mt-2 text-xs text-slate-500">
            Postavite 0 za „bez upozorenja".
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Akcije</div>
          <AdjustStockButton partId={part.id} />
          <Link
            href={`/warehouse/receipts/new?partId=${part.id}`}
            className="btn btn-outline h-10 text-center"
          >
            + Nova primka s ovim dijelom
          </Link>
          <VisibilityToggle partId={part.id} hidden={isHidden} />
          {isCustom && (
            <DeleteCustomPartButton
              partId={part.id}
              manufacturerId={part.manufacturer.id}
            />
          )}
        </div>
      </section>

      {/* Povijest */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Povijest ulaza</h2>
        <p className="text-xs text-slate-500">
          Prikazuju se primke i ručne korekcije. Izdavanja na radnim nalozima se ne prikazuju ovdje —
          vidljiva su u samom nalogu.
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
                <th className="px-3 py-2">Primka</th>
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
                          : "bg-sky-100 text-sky-900"
                      }`}
                    >
                      {h.type === "RECEIPT" ? "Primka" : "Korekcija"}
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
                      <Link href={`/warehouse/receipts/${h.receiptId}`} className="hover:underline">
                        {h.receiptNumber}
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
                    Još nema ulaza za ovaj dio.
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
