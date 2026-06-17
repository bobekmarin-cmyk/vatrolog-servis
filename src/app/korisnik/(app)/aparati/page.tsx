import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getOwnerActiveLinks, getOwnerExtinguishers } from "@/lib/ownerPortalData";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ serviser?: string; odjel?: string }> };

export default async function OwnerAparatiPage({ searchParams }: PageProps) {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");

  const { serviser, odjel } = await searchParams;
  const links = await getOwnerActiveLinks(session.ownerId);
  const all = await getOwnerExtinguishers(links);

  const servisers = [...new Set(all.map((e) => e.servicerName))].sort();
  const departments = [...new Set(all.map((e) => e.departmentName).filter((d): d is string => !!d))].sort();

  const filtered = all.filter((e) => {
    if (serviser && e.servicerName !== serviser) return false;
    if (odjel && (e.departmentName ?? "") !== odjel) return false;
    return true;
  });

  const now = new Date();
  const inOneMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aparati</h1>
          <p className="mt-1 text-sm text-slate-600">{filtered.length} od {all.length} aparata</p>
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

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Oznaka</th>
                <th className="px-3 py-2">Tip</th>
                <th className="px-3 py-2">Proizvođač</th>
                <th className="px-3 py-2">Serijski br.</th>
                <th className="px-3 py-2">Servis</th>
                <th className="px-3 py-2">Odjeljenje</th>
                <th className="px-3 py-2">Idući servis</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((e) => {
                const due = e.nextPeriodicDue;
                const isOverdue = due && due < now;
                const isSoon = due && !isOverdue && due <= inOneMonth;
                return (
                  <tr key={`${e.companyId}-${e.id}`} className={isOverdue ? "bg-red-50" : isSoon ? "bg-amber-50" : ""}>
                    <td className="px-3 py-2 font-medium">{e.internalCode}</td>
                    <td className="px-3 py-2">{e.typeCode ?? "—"}</td>
                    <td className="px-3 py-2">{e.manufacturerName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.serialNumber}</td>
                    <td className="px-3 py-2">{e.servicerName}</td>
                    <td className="px-3 py-2">{e.departmentName ?? "—"}</td>
                    <td className="px-3 py-2">
                      {due ? due.toLocaleDateString("hr-HR") : "—"}
                      {isOverdue ? <span className="ml-1 text-xs font-semibold text-red-600">istekao</span> : null}
                      {isSoon ? <span className="ml-1 text-xs font-semibold text-amber-700">uskoro</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/korisnik/pregledi/novi?ext=${encodeURIComponent(e.id)}&company=${encodeURIComponent(e.companyId)}`}
                        className="text-xs font-semibold text-red-700 hover:underline"
                      >
                        Redovni pregled
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">Nema aparata za odabrani filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
