import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { getEnabledPlatformManufacturers, getCompanyPartOverridesByPartIds, partActiveForCompany } from "@/lib/partsCatalog";

export const dynamic = "force-dynamic";

function totalStockQtyClass(totalQty: number): string {
  if (totalQty < 0) return "text-rose-700";
  return "text-slate-900";
}

function alertLinesClass(low: number, negative: number): string {
  if (negative > 0) return "text-rose-700";
  if (low > 0) return "text-amber-700";
  return "text-slate-900";
}

export default async function WarehousePartsIndexPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [auths, allParts, stocks, recentReceipts] = await Promise.all([
    prisma.companyManufacturerAuthorization.findMany({
      where: { companyId: session.companyId, active: true },
      include: {
        manufacturer: {
          select: { id: true, name: true, displayName: true },
        },
      },
    }),
    prisma.part.findMany({
      where: {
        OR: [{ companyId: null }, { companyId: session.companyId }],
      },
      select: {
        id: true,
        manufacturerId: true,
        companyId: true,
        code: true,
        manufacturerCode: true,
        name: true,
        active: true,
        defaultPrice: true,
        unit: true,
      },
    }),
    prisma.partStock.findMany({
      where: { companyId: session.companyId },
      select: {
        stockQty: true,
        minStockQty: true,
        partId: true,
        part: { select: { manufacturerId: true } },
      },
    }),
    prisma.stockReceipt.findMany({
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

  const manufacturers = auths
    .map((a) => a.manufacturer)
    .sort((a, b) => displayManufacturer(a).localeCompare(displayManufacturer(b), "hr"));

  const manufacturerIds = manufacturers.map((m) => m.id);
  const enabledPlatform = await getEnabledPlatformManufacturers(prisma, {
    companyId: session.companyId,
    manufacturerIds,
  });
  const overrides = await getCompanyPartOverridesByPartIds(prisma, {
    companyId: session.companyId,
    partIds: allParts.map((p) => p.id),
  });

  // Pripremi set partId-jeva koji su trenutno DOSTUPNI tenantu (po novim pravilima).
  const availablePartIds = new Set<string>();
  const availableCountByManu = new Map<string, number>();
  for (const p of allParts) {
    const isCustom = p.companyId !== null;
    const isPlatform = !isCustom;
    const inCatalog = isCustom || enabledPlatform.has(p.manufacturerId);
    const ov = overrides.get(p.id) ?? null;
    if (!inCatalog) continue;
    if (!partActiveForCompany(p, ov)) continue;
    availablePartIds.add(p.id);
    availableCountByManu.set(p.manufacturerId, (availableCountByManu.get(p.manufacturerId) ?? 0) + (isPlatform || isCustom ? 1 : 0));
  }

  const statsByManu = new Map<string, { low: number; negative: number; tracked: number }>();
  const qtySumByManu = new Map<string, number>();
  for (const s of stocks) {
    if (!availablePartIds.has(s.partId)) continue;
    const mId = s.part.manufacturerId;
    const entry = statsByManu.get(mId) ?? { low: 0, negative: 0, tracked: 0 };
    entry.tracked++;
    if (s.stockQty <= s.minStockQty && s.minStockQty > 0) entry.low++;
    if (s.stockQty < 0) entry.negative++;
    statsByManu.set(mId, entry);
    qtySumByManu.set(mId, (qtySumByManu.get(mId) ?? 0) + s.stockQty);
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Skladište – dijelovi</h1>
          <p className="mt-1 text-sm text-slate-600">
            Dijelovi su definirani na platform razini; ovdje vodite stanje vaše tvrtke. Ispod su samo proizvođači
            za koje imate aktivno ovlaštenje (
            <Link href="/admin/settings/authorizations" className="underline">
              Postavke → Ovlaštenja
            </Link>
            ).
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/warehouse/receipts/new" className="btn btn-primary h-10">
            + Nova primka
          </Link>
          <Link href="/warehouse/receipts" className="btn btn-outline h-10">
            Sve primke
          </Link>
        </div>
      </div>

      {manufacturers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          Nemate aktivnih ovlaštenja za nijednog proizvođača. Uključite ih u{" "}
          <Link href="/admin/settings/authorizations" className="font-medium text-slate-900 underline">
            Postavke → Ovlaštenja
          </Link>
          .
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {manufacturers.map((m) => {
            const stats = statsByManu.get(m.id) ?? { low: 0, negative: 0, tracked: 0 };
            const allOk = stats.low === 0 && stats.negative === 0;
            const title = displayManufacturer(m);
            const totalKom = qtySumByManu.get(m.id) ?? 0;
            const alertN = stats.low + stats.negative;
            const catCount = availableCountByManu.get(m.id) ?? 0;
            return (
              <Link
                key={m.id}
                href={`/warehouse/manufacturer/${m.id}`}
                className="group flex min-h-0 flex-col rounded-md border border-slate-200 bg-white px-2 py-1.5 transition-colors hover:border-slate-400"
              >
                <div
                  className="line-clamp-2 text-xs font-medium leading-snug text-slate-900 group-hover:underline"
                  title={title}
                >
                  {title}
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-x-0.5 border-t border-slate-100 pt-1.5">
                  <div className="min-w-0 text-center">
                    <div className="text-[9px] font-medium uppercase leading-none tracking-wide text-slate-500">
                      Kat.
                    </div>
                    <div className="mt-0.5 text-lg font-bold tabular-nums leading-none text-slate-900">
                      {catCount}
                    </div>
                  </div>
                  <div className="min-w-0 text-center">
                    <div className="text-[9px] font-medium uppercase leading-none tracking-wide text-slate-500">
                      Kom.
                    </div>
                    <div
                      className={
                        "mt-0.5 text-lg font-bold tabular-nums leading-none " + totalStockQtyClass(totalKom)
                      }
                    >
                      {totalKom}
                    </div>
                  </div>
                  <div className="min-w-0 text-center">
                    <div className="text-[9px] font-medium uppercase leading-none tracking-wide text-slate-500">
                      Upoz.
                    </div>
                    <div
                      className={
                        "mt-0.5 text-lg font-bold tabular-nums leading-none " +
                        alertLinesClass(stats.low, stats.negative)
                      }
                    >
                      {alertN}
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex min-h-[1.125rem] flex-wrap items-center gap-0.5 text-[10px] leading-tight">
                  {allOk ? (
                    <span className="inline-flex items-center gap-0.5 text-emerald-700">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-500" /> OK
                    </span>
                  ) : (
                    <>
                      {stats.low > 0 && (
                        <span className="rounded bg-amber-100 px-1 py-px text-amber-900">min: {stats.low}</span>
                      )}
                      {stats.negative > 0 && (
                        <span className="rounded bg-rose-100 px-1 py-px text-rose-900">−: {stats.negative}</span>
                      )}
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {/* Zadnje primke */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Zadnje primke</h2>
          <Link href="/warehouse/receipts" className="text-sm text-slate-600 hover:underline">
            Sve primke →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Broj</th>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">Dobavljač</th>
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
                      <Link href={`/warehouse/receipts/${r.id}`} className="hover:underline">
                        {r.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateDdMmYyyy(r.receiptDate)}</td>
                    <td className="px-3 py-2">{r.supplierName}</td>
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
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    Još nema primki. Kliknite <strong>Nova primka</strong> da unesete prvu.
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
