import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getOwnerActiveLinks, getOwnerExtinguishers, getOwnerWorkOrders } from "@/lib/ownerPortalData";
import { getOwnerInspectionStates } from "@/lib/ownerInspections";

export const dynamic = "force-dynamic";

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

export default async function OwnerDashboardPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");

  const links = await getOwnerActiveLinks(session.ownerId);

  if (links.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Dobrodošli</h1>
        <p className="mt-2 text-sm text-slate-600">
          Vaš pristup je aktiviran, ali još nije povezan ni s jednim servisom. Kad vas serviser poveže, ovdje ćete vidjeti svoje aparate i naloge.
        </p>
      </section>
    );
  }

  const [exts, orders] = await Promise.all([
    getOwnerExtinguishers(links),
    getOwnerWorkOrders(links, 5),
  ]);

  const now = new Date();
  const inOneMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const overdue = exts.filter((e) => e.nextPeriodicDue && e.nextPeriodicDue < now);
  const dueSoon = exts.filter((e) => e.nextPeriodicDue && e.nextPeriodicDue >= now && e.nextPeriodicDue <= inOneMonth);

  const inspectionStates = await getOwnerInspectionStates(
    session.ownerId,
    exts.map((e) => ({ id: e.id, lastPeriodicAt: e.lastPeriodicAt })),
  );
  const inspectionDue = [...inspectionStates.values()].filter((s) => s.overdue).length;

  return (
    <>
      <section>
        <h1 className="text-2xl font-bold text-slate-900">Pregled</h1>
        <p className="mt-1 text-sm text-slate-600">
          Povezani servisi: {links.map((l) => l.companyName).join(", ")}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ukupno aparata" value={exts.length} tone="neutral" />
        <StatCard label="Istekao servisni rok" value={overdue.length} tone={overdue.length > 0 ? "danger" : "success"} />
        <StatCard label="Ističe ovaj mjesec" value={dueSoon.length} tone={dueSoon.length > 0 ? "warning" : "success"} />
        <StatCard label="Treba redovni pregled" value={inspectionDue} tone={inspectionDue > 0 ? "danger" : "success"} />
      </div>

      {inspectionDue > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            {inspectionDue} {inspectionDue === 1 ? "aparat treba" : "aparata treba"} redovni (tromjesečni) pregled.
          </p>
          <Link href="/korisnik/pregledi" className="btn btn-primary h-9">Otvori redovne preglede</Link>
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold">Zadnji servisni nalozi</h2>
          <Link href="/korisnik/nalozi" className="text-sm text-red-700 hover:underline">Svi nalozi →</Link>
        </header>
        <div className="divide-y divide-slate-200">
          {orders.map((o) => (
            <div key={o.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="font-semibold text-slate-900">{o.orderNumber}</div>
                <div className="text-sm text-slate-600">
                  {o.servicerName} · zaprimljeno {o.receivedAt.toLocaleDateString("hr-HR")}
                  {o.finishedAt ? ` · završeno ${o.finishedAt.toLocaleDateString("hr-HR")}` : ""}
                </div>
              </div>
              <div className="text-sm text-slate-600">{o.itemsServiced}/{o.itemsTotal} stavki servisirano</div>
            </div>
          ))}
          {orders.length === 0 && <div className="p-6 text-center text-sm text-slate-500">Još nema servisnih naloga.</div>}
        </div>
      </section>
    </>
  );
}
