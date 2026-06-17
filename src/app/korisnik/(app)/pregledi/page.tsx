import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getOwnerActiveLinks, getOwnerExtinguishers } from "@/lib/ownerPortalData";
import { getOwnerInspectionStates, getOwnerInspectionHistory } from "@/lib/ownerInspections";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ spremljeno?: string }> };

function StatCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "success" | "warning" | "danger" }) {
  const cls =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${cls}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}

export default async function OwnerInspectionsPage({ searchParams }: PageProps) {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");

  const { spremljeno } = await searchParams;
  const links = await getOwnerActiveLinks(session.ownerId);
  const exts = await getOwnerExtinguishers(links);
  const states = await getOwnerInspectionStates(
    session.ownerId,
    exts.map((e) => ({ id: e.id, lastPeriodicAt: e.lastPeriodicAt })),
  );
  const history = await getOwnerInspectionHistory(session.ownerId, 100);

  const rows = exts.map((e) => ({ ext: e, state: states.get(e.id) ?? null }));
  const overdue = rows.filter((r) => r.state?.overdue);
  const dueSoon = rows.filter((r) => r.state && !r.state.overdue && r.state.dueSoon);
  const upToDate = rows.length - overdue.length - dueSoon.length;

  // Za pregled: prvo zakašnjeli, pa oni koji uskoro dospijevaju.
  const toInspect = [...overdue, ...dueSoon];

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Redovni pregledi</h1>
          <p className="mt-1 text-sm text-slate-600">Tromjesečni pregled aparata koji obavlja vlasnik.</p>
        </div>
        <Link href="/korisnik/pregledi/skeniraj" className="btn btn-primary h-9">Skeniraj / unesi pregled</Link>
      </section>

      {spremljeno ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Pregled je spremljen.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Treba pregledati" value={overdue.length} tone={overdue.length > 0 ? "danger" : "success"} />
        <StatCard label="Uskoro dospijeva" value={dueSoon.length} tone={dueSoon.length > 0 ? "warning" : "success"} />
        <StatCard label="Pregledano na vrijeme" value={Math.max(0, upToDate)} tone="neutral" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold">Za pregled</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Oznaka</th>
                <th className="px-3 py-2">Tip</th>
                <th className="px-3 py-2">Servis</th>
                <th className="px-3 py-2">Odjeljenje</th>
                <th className="px-3 py-2">Zadnji pregled</th>
                <th className="px-3 py-2">Rok</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {toInspect.map(({ ext, state }) => (
                <tr key={`${ext.companyId}-${ext.id}`} className={state?.overdue ? "bg-red-50" : "bg-amber-50"}>
                  <td className="px-3 py-2 font-medium">{ext.internalCode}</td>
                  <td className="px-3 py-2">{ext.typeCode ?? "—"}</td>
                  <td className="px-3 py-2">{ext.servicerName}</td>
                  <td className="px-3 py-2">{ext.departmentName ?? "—"}</td>
                  <td className="px-3 py-2">
                    {state?.lastInspectedAt ? state.lastInspectedAt.toLocaleDateString("hr-HR") : <span className="text-slate-500">nikad</span>}
                  </td>
                  <td className="px-3 py-2">
                    {state?.nextDue ? state.nextDue.toLocaleDateString("hr-HR") : "—"}
                    {state?.overdue ? <span className="ml-1 text-xs font-semibold text-red-600">dospjelo</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/korisnik/pregledi/novi?ext=${encodeURIComponent(ext.id)}&company=${encodeURIComponent(ext.companyId)}`}
                      className="btn btn-primary h-8"
                    >
                      Unesi pregled
                    </Link>
                  </td>
                </tr>
              ))}
              {toInspect.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    Svi aparati su pregledani na vrijeme.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold">Povijest pregleda</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">Oznaka</th>
                <th className="px-3 py-2">Servis</th>
                <th className="px-3 py-2">Nalaz</th>
                <th className="px-3 py-2">Pregled obavio</th>
                <th className="px-3 py-2">Opaske</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-3 py-2">{h.inspectedAt.toLocaleDateString("hr-HR")}</td>
                  <td className="px-3 py-2 font-medium">{h.internalCode}</td>
                  <td className="px-3 py-2">{h.servicerName}</td>
                  <td className="px-3 py-2">
                    {h.result === "OK" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">U redu</span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Nedostaci</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{h.performedByName ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{h.note ?? "—"}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">Još nema unesenih pregleda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <h2 className="text-base font-semibold text-slate-900">O redovnom pregledu</h2>
        <p className="mt-2">
          Redovni pregled vatrogasnog aparata obavlja njegov vlasnik (korisnik), preporučeno je barem jednom u tri mjeseca.
          Obratite pažnju na dostupnost, položaj aparata, njegove oznake, kompletnost i eventualna oštećenja te na stanje
          plombe zatvarača odnosno ventila. Kod „P“ aparata sa stalnim tlakom provjerite je li kazaljka manometra u zelenom polju.
        </p>
        <p className="mt-2">
          Uočene nedostatke korisnik je obavezan odmah otkloniti sam ili uz pomoć stručne osobe. Nakon svake upotrebe aparat
          treba pregledati i ponovo napuniti u ovlaštenom servisu.
        </p>
      </section>
    </>
  );
}
