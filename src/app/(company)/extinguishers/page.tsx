import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { calcValidUntil, fmtDateHR, isStillValid } from "@/lib/validity";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import ExtinguisherStatusIcon from "@/components/ExtinguisherStatusIcon";
import { resolveExtStatus } from "@/lib/extinguisherStatus";
import Pagination from "@/components/Pagination";
import EmptyState from "@/components/EmptyState";

const PAGE_SIZE = 100;

function ValidUntilBadge({ date }: { date: Date | null }) {
  if (!date) return <span className="text-gray-400">-</span>;

  const ok = isStillValid(date);
  return (
    <span
      className={[
        "badge",
        ok ? "badge-success" : "badge-danger",
      ].join(" ")}
      title={ok ? "Periodični pregled još vrijedi" : "Periodični pregled je istekao"}
    >
      {fmtDateHR(date)}
    </span>
  );
}

export default async function ExtinguishersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;

  const internalCode = String(sp.internalCode ?? "").trim();
  const serialNumber = String(sp.serialNumber ?? "").trim();
  const owner = String(sp.owner ?? "").trim();
  const yearRaw = String(sp.year ?? "").trim();

  const sort = (String(sp.sort ?? "internalCode") as "internalCode" | "productionYear") || "internalCode";
  const dir = (String(sp.dir ?? (sort === "productionYear" ? "desc" : "asc")) as "asc" | "desc") || "asc";
  const pageNum = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const year = yearRaw ? Number(yearRaw) : undefined;

  const where: Prisma.ExtinguisherWhereInput = {
    AND: [
      { companyId: session.companyId },
      internalCode ? { internalCode: { contains: internalCode, mode: "insensitive" } } : {},
      serialNumber ? { serialNumber: { contains: serialNumber, mode: "insensitive" } } : {},
      Number.isFinite(year) ? { productionYear: year } : {},
      owner
        ? {
            workItems: {
              some: {
                workOrder: {
                  customer: {
                    OR: [{ name: { contains: owner, mode: "insensitive" } }, { oib: { contains: owner } }],
                  },
                },
              },
            },
          }
        : {},
    ],
  };

  const orderBy =
    sort === "productionYear"
      ? [{ productionYear: dir }, { internalCode: "asc" as const }]
      : [{ internalCode: dir }, { productionYear: "desc" as const }];

  const [total, extinguishers] = await Promise.all([
    prisma.extinguisher.count({ where }),
    prisma.extinguisher.findMany({
      where,
      orderBy,
      include: {
        manufacturer: true,
        type: { include: { agent: true, construction: true } },
        workItems: {
          orderBy: [{ servicedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          include: { workOrder: { include: { customer: true } } },
        },
      },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const paginationParams: Record<string, string | undefined> = {
    internalCode: internalCode || undefined,
    serialNumber: serialNumber || undefined,
    year: yearRaw || undefined,
    owner: owner || undefined,
    sort,
    dir,
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Aparati</h1>

        <Link className="btn btn-outline px-4" href="/work-orders">
          ← Nalozi
        </Link>
      </div>

      <section className="surface p-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <form method="get" action="/extinguishers" className="flex flex-wrap items-end gap-2">
            {owner ? <input type="hidden" name="owner" value={owner} /> : null}
            <div>
              <label className="label text-xs">Interni</label>
              <input
                name="internalCode"
                defaultValue={internalCode}
                placeholder="0100900001"
                className="input h-9 w-[140px] font-mono text-xs"
              />
            </div>
            <div>
              <label className="label text-xs">Serijski</label>
              <input
                name="serialNumber"
                defaultValue={serialNumber}
                placeholder="Serijski"
                className="input h-9 w-[130px] text-xs"
              />
            </div>
            <div>
              <label className="label text-xs">Godina</label>
              <input name="year" type="number" defaultValue={yearRaw} placeholder="2018" className="input h-9 w-[90px] text-xs" />
            </div>
            <div>
              <label className="label text-xs">Sort</label>
              <select name="sort" defaultValue={sort} className="select h-9 text-xs">
                <option value="internalCode">Interni broj</option>
                <option value="productionYear">Godina</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Smjer</label>
              <select name="dir" defaultValue={dir} className="select h-9 text-xs">
                <option value="asc">↑</option>
                <option value="desc">↓</option>
              </select>
            </div>
            <button
              className="btn btn-primary h-9 w-9 p-0 text-base leading-none"
              type="submit"
              title="Primijeni filter"
              aria-label="Primijeni filter"
            >
              ✓
            </button>
            <Link className="btn btn-outline h-9 w-9 p-0 text-base leading-none" href="/extinguishers" title="Reset filtera" aria-label="Reset filtera">
              ↺
            </Link>
          </form>

          <form method="get" action="/extinguishers" className="flex flex-wrap items-center justify-end gap-2">
            {internalCode ? <input type="hidden" name="internalCode" value={internalCode} /> : null}
            {serialNumber ? <input type="hidden" name="serialNumber" value={serialNumber} /> : null}
            {yearRaw ? <input type="hidden" name="year" value={yearRaw} /> : null}
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <input
              name="owner"
              defaultValue={owner}
              placeholder="Pretraži: naziv kupca ili OIB..."
              className="input h-9 w-[200px] sm:w-[250px] lg:w-[300px] text-xs"
            />
            <button className="btn btn-primary h-9 w-9 p-0 text-base leading-none" type="submit" title="Traži" aria-label="Traži">
              🔍
            </button>
            <Link
              className="btn btn-outline h-9 w-9 p-0 text-base leading-none"
              href={`/extinguishers?internalCode=${encodeURIComponent(internalCode)}&serialNumber=${encodeURIComponent(serialNumber)}&year=${encodeURIComponent(
                yearRaw
              )}&sort=${encodeURIComponent(sort)}&dir=${encodeURIComponent(dir)}`}
              title="Očisti pretragu"
              aria-label="Očisti pretragu"
            >
              ✕
            </Link>
          </form>
        </div>
      </section>

      {/* TABLICA */}
      <section className="surface">
        <Pagination
          basePath="/extinguishers"
          params={paginationParams}
          page={pageNum}
          pageSize={PAGE_SIZE}
          total={total}
        />
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Status</th>
                <th className="table-cell whitespace-nowrap">Interni broj</th>
                <th className="table-cell">Proizvođač</th>
                <th className="table-cell">Tip</th>
                <th className="table-cell whitespace-nowrap">Serijski + godina</th>
                <th className="table-cell">Trenutni vlasnik</th>
                <th className="table-cell whitespace-nowrap">Trenutna naljepnica</th>
                <th className="table-cell whitespace-nowrap">Vrijedi do</th>
                <th className="table-cell text-right whitespace-nowrap">Opcije</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {extinguishers.map((ex) => {
                const last = ex.workItems?.[0] ?? null;
                const currentOwner = last?.workOrder?.customer ? customerDisplayName(last.workOrder.customer) : "-";
                const currentLabel = last?.labelNumber ?? "-";

                const isScrapped = ex.status === "SCRAPPED" || !!ex.scrapReason || !!ex.scrappedAt;
                const validUntil = last?.nextPeriodicDue ?? (last?.servicedAt ? calcValidUntil(last.servicedAt) : null);
                const ppExpired = !validUntil || !isStillValid(validUntil);
                const extStatus = resolveExtStatus(isScrapped, ppExpired);

                return (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <ExtinguisherStatusIcon status={extStatus} />
                    </td>

                    <td className="table-cell font-mono text-xs whitespace-nowrap">{ex.internalCode}</td>
                    <td className="table-cell">
                      <div className="clamp-2 max-w-[220px]" title={displayManufacturer(ex.manufacturer)}>
                        {displayManufacturer(ex.manufacturer)}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="clamp-2 max-w-[220px]" title={ex.type ? formatExtinguisherTypeName(ex.type) : undefined}>
                        {ex.type ? formatExtinguisherTypeName(ex.type) : "-"}
                      </div>
                    </td>

                    <td className="table-cell whitespace-nowrap">
                      <div className="font-mono text-xs">{ex.serialNumber}</div>
                      <div className="table-muted">{ex.productionYear}</div>
                    </td>

                    <td className="table-cell">
                      <div className="clamp-2 max-w-[260px]" title={currentOwner}>
                        {currentOwner}
                      </div>
                    </td>
                    <td className="table-cell font-mono text-xs whitespace-nowrap">{currentLabel}</td>

                    <td className="table-cell whitespace-nowrap">
                      <ValidUntilBadge date={validUntil} />
                    </td>

                    <td className="table-cell text-right whitespace-nowrap">
                      <Link
                        href={`/extinguishers/${ex.id}`}
                        className="btn btn-outline px-3 py-1 text-xs"
                        title="Otvori aparat"
                        aria-label="Otvori aparat"
                      >
                        Aparat
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {extinguishers.length === 0 && (
                <tr>
                  <td className="p-0" colSpan={9}>
                    {(internalCode || serialNumber || owner || yearRaw) ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        Nema rezultata za zadane filtere.
                      </div>
                    ) : (
                      <EmptyState
                        icon="🧯"
                        title="Još nema aparata u evidenciji."
                        description="Aparati se najlakše dodaju kroz prvi radni nalog — sustav automatski dodjeljuje internu šifru i veže ih za kupca."
                        actions={[
                          {
                            href: "/work-orders/new",
                            label: "Otvori prvi radni nalog",
                            primary: true,
                          },
                          { href: "/customers", label: "Pregledaj kupce" },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          basePath="/extinguishers"
          params={paginationParams}
          page={pageNum}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </section>
    </main>
  );
}

