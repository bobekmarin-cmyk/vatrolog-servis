import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getOwnerActiveLinks, getOwnerWorkOrders } from "@/lib/ownerPortalData";

export const dynamic = "force-dynamic";

export default async function OwnerNaloziPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");

  const links = await getOwnerActiveLinks(session.ownerId);
  const orders = await getOwnerWorkOrders(links, 200);

  return (
    <>
      <section>
        <h1 className="text-2xl font-bold text-slate-900">Servisni nalozi</h1>
        <p className="mt-1 text-sm text-slate-600">{orders.length} naloga</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Nalog</th>
                <th className="px-3 py-2">Servis</th>
                <th className="px-3 py-2">Zaprimljeno</th>
                <th className="px-3 py-2">Završeno</th>
                <th className="px-3 py-2">Servisirano</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={`${o.companyId}-${o.id}`}>
                  <td className="px-3 py-2 font-medium">{o.orderNumber}</td>
                  <td className="px-3 py-2">{o.servicerName}</td>
                  <td className="px-3 py-2">{o.receivedAt.toLocaleDateString("hr-HR")}</td>
                  <td className="px-3 py-2">{o.finishedAt ? o.finishedAt.toLocaleDateString("hr-HR") : "—"}</td>
                  <td className="px-3 py-2">{o.itemsServiced}/{o.itemsTotal}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500">Još nema servisnih naloga.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
