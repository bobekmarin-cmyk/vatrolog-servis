import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { SERVICE_LABEL_KINDS } from "@/lib/serviceLabelKind";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export const dynamic = "force-dynamic";

/** Kratice u jednom retku zaliha (kompaktan pregled). */
const KIND_COMPACT: Record<string, string> = {
  PERIODIC: "PP",
  APPARATUS_MASS: "MA",
  CYLINDER_MASS: "MB",
};

function qtyTextClass(qty: number, min: number): string {
  if (qty < 0) return "text-rose-700";
  if (min > 0 && qty <= min) return "text-amber-700";
  return "text-slate-900";
}

export default async function ServiceLabelsWarehousePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [auths, labels, stocks, recentReceipts] = await Promise.all([
    prisma.companyManufacturerAuthorization.findMany({
      where: { companyId: session.companyId, active: true },
      include: {
        manufacturer: { select: { id: true, name: true, displayName: true, sortOrder: true } },
      },
    }),
    prisma.serviceLabel.findMany({
      select: { id: true, manufacturerId: true, kind: true },
    }),
    prisma.serviceLabelStock.findMany({
      where: { companyId: session.companyId },
      select: {
        serviceLabelId: true,
        stockQty: true,
        minStockQty: true,
      },
    }),
    prisma.serviceLabelReceipt.findMany({
      where: { companyId: session.companyId },
      orderBy: { receiptDate: "desc" },
      take: 5,
      include: {
        _count: { select: { items: true } },
        items: { select: { quantity: true } },
        createdBy: { select: { username: true, email: true } },
      },
    }),
  ]);

  const labelByManuKind = new Map<string, { id: string }>();
  for (const l of labels) {
    labelByManuKind.set(`${l.manufacturerId}:${l.kind}`, { id: l.id });
  }
  const stockByLabel = new Map(stocks.map((s) => [s.serviceLabelId, s]));

  const sortedAuths = auths
    .slice()
    .sort((a, b) => {
      const so = (a.manufacturer.sortOrder ?? 0) - (b.manufacturer.sortOrder ?? 0);
      if (so !== 0) return so;
      return displayManufacturer(a.manufacturer).localeCompare(displayManufacturer(b.manufacturer), "hr");
    });

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Skladište – naljepnice</h1>
          <p className="mt-1 text-sm text-slate-600">
            Stanja servisnih naljepnica po proizvođaču. Prikazuju se samo proizvođači za koje imate
            aktivno ovlaštenje. Ovlaštenja i interne šifre uređuju se u{" "}
            <Link href="/admin/settings/authorizations" className="underline">
              Postavke → Ovlaštenja
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/warehouse/labels/receipts/new" className="btn btn-primary h-10">
            + Nova primka
          </Link>
          <Link href="/warehouse/labels/receipts" className="btn btn-outline h-10">
            Sve primke
          </Link>
        </div>
      </div>

      {sortedAuths.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          Trenutno nemate aktivnih ovlaštenja. Aktivirajte ih u{" "}
          <Link href="/admin/settings/authorizations" className="text-slate-900 underline">
            Postavke → Ovlaštenja
          </Link>{" "}
          kako biste vidjeli odgovarajuće naljepnice.
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {sortedAuths.map((auth) => {
            const title = displayManufacturer(auth.manufacturer);
            let lowKinds = 0;
            let negKinds = 0;
            const kindCells: Array<{ kind: string; abbr: string; qty: number; min: number }> = [];
            for (const kind of SERVICE_LABEL_KINDS) {
              const label = labelByManuKind.get(`${auth.manufacturerId}:${kind}`);
              const stock = label ? stockByLabel.get(label.id) : undefined;
              const qty = stock?.stockQty ?? 0;
              const min = stock?.minStockQty ?? 0;
              if (qty < 0) negKinds++;
              else if (min > 0 && qty <= min) lowKinds++;
              kindCells.push({ kind, abbr: KIND_COMPACT[kind] ?? kind, qty, min });
            }
            const allOk = lowKinds === 0 && negKinds === 0;
            return (
              <Link
                key={auth.manufacturerId}
                href={`/warehouse/labels/manufacturer/${auth.manufacturerId}`}
                className="group flex min-h-0 flex-col rounded-md border border-slate-200 bg-white px-2 py-1.5 transition-colors hover:border-slate-400"
              >
                <div
                  className="line-clamp-2 text-xs font-medium leading-snug text-slate-900 group-hover:underline"
                  title={title}
                >
                  {title}
                </div>
                {auth.expiresAt && (
                  <div className="mt-0.5 truncate text-[10px] text-slate-500">
                    do {formatDateDdMmYyyy(auth.expiresAt)}
                  </div>
                )}
                <div className="mt-1.5 grid grid-cols-3 gap-x-0.5 border-t border-slate-100 pt-1.5">
                  {kindCells.map((c) => (
                    <div key={c.kind} className="min-w-0 text-center">
                      <div className="text-[9px] font-medium uppercase leading-none tracking-wide text-slate-500">
                        {c.abbr}
                      </div>
                      <div
                        className={
                          "mt-0.5 text-lg font-bold tabular-nums leading-none " + qtyTextClass(c.qty, c.min)
                        }
                      >
                        {c.qty}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex min-h-[1.125rem] flex-wrap items-center gap-0.5 text-[10px] leading-tight">
                  {allOk ? (
                    <span className="inline-flex items-center gap-0.5 text-emerald-700">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-500" /> OK
                    </span>
                  ) : (
                    <>
                      {lowKinds > 0 && (
                        <span className="rounded bg-amber-100 px-1 py-px text-amber-900">min: {lowKinds}</span>
                      )}
                      {negKinds > 0 && (
                        <span className="rounded bg-rose-100 px-1 py-px text-rose-900">−: {negKinds}</span>
                      )}
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Zadnje primke</h2>
          <Link href="/warehouse/labels/receipts" className="text-sm text-slate-600 hover:underline">
            Sve primke →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Broj</th>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">Referenca</th>
                <th className="px-3 py-2 text-right">Stavki</th>
                <th className="px-3 py-2 text-right">Ukupno kom.</th>
                <th className="px-3 py-2">Unio</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentReceipts.map((r) => {
                const totalQty = r.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/warehouse/labels/receipts/${r.id}`} className="hover:underline">
                        {r.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateDdMmYyyy(r.receiptDate)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.reference ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r._count.items}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{totalQty}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.createdBy?.username ?? r.createdBy?.email ?? "—"}
                    </td>
                  </tr>
                );
              })}
              {recentReceipts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                    Još nema primki naljepnica. Kliknite <strong>Nova primka</strong> za prvu.
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
