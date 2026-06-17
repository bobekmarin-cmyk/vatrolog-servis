import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getOwnerActiveLinks, getOwnerDeliveryNotes } from "@/lib/ownerPortalData";

export const dynamic = "force-dynamic";

export default async function OwnerDokumentiPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");

  const links = await getOwnerActiveLinks(session.ownerId);
  const notes = await getOwnerDeliveryNotes(links, 200);

  return (
    <>
      <section>
        <h1 className="text-2xl font-bold text-slate-900">Dokumenti</h1>
        <p className="mt-1 text-sm text-slate-600">Izdane otpremnice ({notes.length})</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Broj otpremnice</th>
                <th className="px-3 py-2">Nalog</th>
                <th className="px-3 py-2">Servis</th>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {notes.map((n) => (
                <tr key={n.id}>
                  <td className="px-3 py-2 font-medium">{n.number}</td>
                  <td className="px-3 py-2">{n.orderNumber}</td>
                  <td className="px-3 py-2">{n.servicerName}</td>
                  <td className="px-3 py-2">{n.issuedAt.toLocaleDateString("hr-HR")}</td>
                  <td className="px-3 py-2">
                    <a
                      href={`/api/portal/delivery-notes/${n.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-red-700 hover:underline"
                    >
                      Otvori
                    </a>
                  </td>
                </tr>
              ))}
              {notes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500">Još nema izdanih otpremnica.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
