import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getActiveOwnerOrgId } from "@/lib/ownerOrg";
import { getOwnerActiveLinks, getOwnerWorkOrders } from "@/lib/ownerPortalData";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ serviser?: string; odjel?: string }> };

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
    >
      {label}
    </a>
  );
}

export default async function OwnerNaloziPage({ searchParams }: PageProps) {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");
  const ownerOrgId = await getActiveOwnerOrgId(session.ownerId);
  if (!ownerOrgId) redirect("/korisnik/odabir");

  const { serviser, odjel } = await searchParams;
  const links = await getOwnerActiveLinks(ownerOrgId);
  const all = await getOwnerWorkOrders(links, 300);

  const servisers = [...new Set(all.map((o) => o.servicerName))].sort();
  const departments = [...new Set(all.map((o) => o.departmentName).filter((d): d is string => !!d))].sort();

  const orders = all.filter((o) => {
    if (serviser && o.servicerName !== serviser) return false;
    if (odjel && (o.departmentName ?? "") !== odjel) return false;
    return true;
  });

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Servisni nalozi i dokumenti</h1>
          <p className="mt-1 text-sm text-slate-600">
            {orders.length} od {all.length} naloga — za svaki preuzmite primku, upisnik, otpremnicu i račun.
          </p>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="serviser">Servis</label>
            <select id="serviser" name="serviser" defaultValue={serviser ?? ""} className="input h-9 min-w-[160px]">
              <option value="">Svi servisi</option>
              {servisers.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="odjel">Odjeljenje</label>
            <select id="odjel" name="odjel" defaultValue={odjel ?? ""} className="input h-9 min-w-[160px]">
              <option value="">Sva odjeljenja</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-outline h-9">Filtriraj</button>
        </form>
      </section>

      <section className="space-y-3">
        {orders.map((o) => {
          const done = o.itemsTotal > 0 && o.itemsServiced === o.itemsTotal;
          return (
            <div
              key={`${o.companyId}-${o.id}`}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-200 hover:shadow md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-slate-900">{o.orderNumber}</span>
                  {o.deliveryNote ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Otpremljeno</span>
                  ) : done ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">Servis završen</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Servis u tijeku</span>
                  )}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {o.servicerName}
                  {o.departmentName ? ` · ${o.departmentName}` : ""}
                  {" · "}zaprimljeno {o.receivedAt.toLocaleDateString("hr-HR")}
                  {o.finishedAt ? ` · završeno ${o.finishedAt.toLocaleDateString("hr-HR")}` : ""}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{o.itemsServiced}/{o.itemsTotal} stavki servisirano</div>
              </div>

              <div className="flex flex-wrap gap-1.5 md:justify-end">
                <DocLink href={`/api/portal/work-orders/${o.id}/primka/pdf`} label="Primka" />
                <DocLink href={`/api/portal/work-orders/${o.id}/register/pdf`} label="Upisnik" />
                {o.deliveryNote ? (
                  <DocLink
                    href={`/api/portal/delivery-notes/${o.deliveryNote.id}/pdf`}
                    label={`Otpremnica ${o.deliveryNote.number}`}
                  />
                ) : (
                  <span className="inline-flex items-center rounded-lg border border-dashed border-slate-200 px-2.5 py-1 text-xs text-slate-400">
                    Otpremnica nije izdana
                  </span>
                )}
                {o.invoice ? (
                  <DocLink
                    href={`/api/portal/invoices/${o.invoice.id}/pdf`}
                    label={`Račun${o.invoice.number ? ` ${o.invoice.number}` : ""}`}
                  />
                ) : null}
              </div>
            </div>
          );
        })}

        {orders.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            {all.length === 0 ? "Još nema servisnih naloga." : "Nema naloga za odabrani filter."}
          </div>
        )}
      </section>
    </>
  );
}
