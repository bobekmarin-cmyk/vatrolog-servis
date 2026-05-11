import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DeleteWorkOrderButton from "@/components/DeleteWorkOrderButton";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import WorkOrderStatusBadge from "@/components/WorkOrderStatusBadge";
import { customerDisplayName } from "@/lib/customerDisplay";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import Pagination from "@/components/Pagination";
import EmptyState from "@/components/EmptyState";

const PAGE_SIZE = 100;

function fmtDateInput(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${yy}-${mm}-${dd}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function parseDateOnly(value: string): Date | null {
  const v = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const out = new Date(y, mo, d);
  if (Number.isNaN(out.getTime())) return null;
  return out;
}

function defaultFrom(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
}

function currentYearWindow(now = new Date()) {
  const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  // Ukljuci i buduce naloge unutar aktualne godine
  const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { from, to };
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const pageNum = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const defFrom = defaultFrom();
  const fromParsed = sp.from ? parseDateOnly(String(sp.from)) : null;
  const toParsed = sp.to ? parseDateOnly(String(sp.to)) : null;
  const fromDate = fromParsed ? startOfDay(fromParsed) : defFrom;
  // "Do" je opcionalan: ako korisnik ne postavi gornju granicu, prikazujemo
  // sve naloge od `from` na dalje (ukljucuje i naloge s buducim datumom).
  const toDate = toParsed ? endOfDay(toParsed) : null;
  const fromPicker = Number.isNaN(fromDate.getTime()) ? defFrom : fromDate;
  const toPicker = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;

  // Kad postoji tekst u search baru, pretrazujemo samo po aktualnoj godini
  // (historijski izvjestaji idu preko Kupci -> Radni nalozi).
  const receivedAtFilter: { gte: Date; lte?: Date } = q
    ? (() => {
        const w = currentYearWindow();
        return { gte: w.from, lte: w.to };
      })()
    : toPicker
      ? { gte: fromPicker, lte: toPicker }
      : { gte: fromPicker };

  const where: {
    companyId: string;
    receivedAt: { gte: Date; lte?: Date };
    AND?: Array<{
      OR: Array<{
        customer:
          | { name: { contains: string; mode: "insensitive" } }
          | { oib: { contains: string; mode: "insensitive" } };
      }>;
    }>;
  } = {
    companyId: session.companyId,
    receivedAt: receivedAtFilter,
  };
  if (q) {
    where.AND = [
      {
        OR: [
          { customer: { name: { contains: q, mode: "insensitive" as const } } },
          { customer: { oib: { contains: q, mode: "insensitive" as const } } },
        ],
      },
    ];
  }

  const [total, orders] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      include: {
        customer: true,
        department: { select: { name: true } },
        items: true,
        serviceLocation: { select: { kind: true, label: true } },
        createdByAccountUser: { select: { username: true } },
      },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const paginationParams = {
    from: sp.from,
    to: sp.to,
    q,
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Radni nalozi</h1>
        <div className="flex gap-2">
          <Link className="btn btn-outline px-4" href="/dashboard">
            ← Dashboard
          </Link>
          <Link className="btn btn-primary px-4" href="/work-orders/new">
            + Novi radni nalog
          </Link>
        </div>
      </div>

      <section className="surface">
        <div className="p-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <form method="get" action="/work-orders" className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="wo-filter-from" className="label text-xs">Od</label>
                <input
                  id="wo-filter-from"
                  className="input h-9 text-xs"
                  type="date"
                  name="from"
                  defaultValue={fmtDateInput(fromPicker)}
                  aria-label="Datum od"
                />
              </div>
              <div>
                <label htmlFor="wo-filter-to" className="label text-xs">Do</label>
                <input
                  id="wo-filter-to"
                  className="input h-9 text-xs"
                  type="date"
                  name="to"
                  defaultValue={toPicker ? fmtDateInput(toPicker) : ""}
                  title="Ostavi prazno za prikaz svih naloga od odabranog datuma nadalje (uključuje buduće)"
                  aria-label="Datum do"
                />
              </div>
              <button
                className="btn btn-primary h-9 w-9 p-0 text-base leading-none"
                type="submit"
                title="Primijeni filter"
                aria-label="Primijeni filter"
              >
                ✓
              </button>
            </form>

            <form method="get" action="/work-orders" className="flex flex-wrap items-center justify-end gap-2">
              <input
                className="input h-9 w-[200px] sm:w-[250px] lg:w-[300px] text-xs"
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Pretraži po kupcu / OIB-u (aktualna godina)"
              />
              <button
                className="btn btn-primary h-9 w-9 p-0 text-base leading-none"
                type="submit"
                title="Traži"
                aria-label="Traži"
              >
                🔍
              </button>
              {q ? (
                <Link
                  className="btn btn-outline h-9 w-9 p-0 text-base leading-none"
                  href="/work-orders"
                  title="Očisti pretragu"
                  aria-label="Očisti pretragu"
                >
                  ✕
                </Link>
              ) : null}
            </form>
          </div>

          {q ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Pretraga se izvršava samo unutar aktualne godine. Za starije naloge koristi Kupci → Radni nalozi kupca.
            </p>
          ) : null}
        </div>
      </section>

      <section className="surface">
        <Pagination
          basePath="/work-orders"
          params={paginationParams}
          page={pageNum}
          pageSize={PAGE_SIZE}
          total={total}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-2 py-2">Nalog</th>
                <th className="px-2 py-2">Datum</th>
                <th className="px-2 py-2">Kupac</th>
                <th className="px-2 py-2">Lokacija</th>
                <th className="px-2 py-2 whitespace-nowrap">Kreirao</th>
                <th className="px-2 py-2 whitespace-nowrap">Napredak</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Akcije</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {orders.map((o) => {
                const inOrder = o.items.length;
                const serviced = o.items.filter((i) => i.servicedAt || i.labelNumber).length;
                const received = o.receivedQty ?? 0;
                const mismatch = received > 0 && received !== inOrder;
                const canDelete = !o.items.some((i) => !!i.servicedAt || !!i.labelNumber);
                const canDeleteByRole = session.role === "ADMIN";
                const disabled = !canDelete;
                const disabledReason = "Nije moguće obrisati: u nalogu postoji servisirana stavka / naljepnica.";

                return (
                  <tr key={o.id} className="hover:bg-slate-50 whitespace-nowrap">
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <Link className="underline font-semibold whitespace-nowrap" href={`/work-orders/${o.id}`}>
                          {o.orderNumber}
                        </Link>
                        {mismatch && (
                          <span
                            className="text-amber-500"
                            title="Količina na primci ne poklapa se s brojem stavki u nalogu"
                          >
                            ⚠
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateDdMmYyyy(o.receivedAt)}
                    </td>
                    <td className="px-2 py-2">
                      <div
                        className="truncate max-w-[360px] font-semibold text-slate-900"
                        title={
                          o.department?.name
                            ? `${customerDisplayName(o.customer)} · ${o.department.name}`
                            : customerDisplayName(o.customer)
                        }
                      >
                        {customerDisplayName(o.customer)}
                        {o.department?.name ? (
                          <span className="font-normal text-slate-500"> · {o.department.name}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-600 max-w-[140px]">
                      {o.serviceLocation ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <span
                              className={`badge badge-tight ${
                                o.serviceLocation.kind === "STATIONARY" ? "badge-info" : "badge-success"
                              }`}
                            >
                              {o.serviceLocation.kind === "STATIONARY" ? "S" : "V"}
                            </span>
                            <span className="truncate" title={o.serviceLocation.label}>
                              {o.serviceLocation.label}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {o.createdByAccountUser?.username ? (
                        o.createdByAccountUser.username
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {(() => {
                        const allDone = inOrder > 0 && serviced === inOrder;
                        const pct = inOrder > 0 ? Math.round((serviced / inOrder) * 100) : 0;
                        return (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-base font-bold tabular-nums ${allDone ? "text-emerald-600" : "text-indigo-700"}`}
                            >
                              {serviced}/{inOrder}
                            </span>
                            <div className="h-2 w-16 rounded-full bg-slate-200">
                              <div
                                className={`h-2 rounded-full transition-all ${allDone ? "bg-emerald-500" : "bg-indigo-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <WorkOrderStatusBadge status={o.status} />
                    </td>

                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <Link className="btn btn-outline px-2 py-1 text-xs mr-2" href={`/work-orders/${o.id}`}>
                        Otvori
                      </Link>
                      {canDeleteByRole ? (
                        <DeleteWorkOrderButton
                          workOrderId={o.id}
                          orderNumber={o.orderNumber}
                          disabled={disabled}
                          disabledReason={disabledReason}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}

              {orders.length === 0 && (
                <tr>
                  <td className="p-0" colSpan={8}>
                    {q ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        Nema naloga koji odgovaraju pretrazi <b>{q}</b> u zadanom razdoblju.
                      </div>
                    ) : total === 0 ? (
                      <EmptyState
                        icon="🧾"
                        title="Još nema radnih naloga."
                        description="Otvorite prvi radni nalog za odabranog kupca i njegove aparate. PDF dostavnice se generiraju automatski po zaključavanju naloga."
                        actions={[
                          {
                            href: "/work-orders/new",
                            label: "+ Novi radni nalog",
                            primary: true,
                          },
                          { href: "/customers", label: "Pregled kupaca" },
                        ]}
                        hint="Ako još nemate kupca, odmah ga možete dodati iz forme novog naloga."
                      />
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        Nema naloga u zadanom razdoblju.
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          basePath="/work-orders"
          params={paginationParams}
          page={pageNum}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </section>

      <p className="mt-3 text-xs text-gray-500">
        Brisanje naloga je moguće samo ako nema servisiranih stavki (naljepnica/servis).
      </p>
    </main>
  );
}
