import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformSession } from "@/lib/platformAuth";
import { getOwnerOrgDetail } from "@/lib/platformOwners";
import { ServicerTable, InviteAccountForm } from "./OwnerOrgActions";

export const dynamic = "force-dynamic";

export default async function PlatformOwnerDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  await requirePlatformSession();
  const { orgId } = await params;
  const detail = await getOwnerOrgDetail(orgId);
  if (!detail) notFound();

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{detail.name ?? "Vlasnik"}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">OIB {detail.oib}</p>
        </div>
        <Link className="btn btn-outline px-3" href="/platform/owners">
          ← Natrag
        </Link>
      </div>

      <section className="surface">
        <div className="surface-header flex items-center justify-between">
          <h2 className="h1">Korisnički računi</h2>
          <span className="text-xs text-slate-500">{detail.accounts.length} računa</span>
        </div>
        <div className="surface-body space-y-3">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Ime</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Zadnja prijava</th>
              </tr>
            </thead>
            <tbody>
              {detail.accounts.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{a.email}</td>
                  <td className="px-3 py-2">{a.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    {a.verified && a.hasPassword ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Aktivan</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Pozvan</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {a.lastLoginAt ? a.lastLoginAt.toLocaleString("hr-HR") : "—"}
                  </td>
                </tr>
              ))}
              {detail.accounts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    Nijedan račun još nije aktiviran. Pošaljite pozivnicu ispod.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="border-t border-slate-100 pt-3">
            <InviteAccountForm orgId={detail.id} />
          </div>
        </div>
      </section>

      <section className="surface">
        <div className="surface-header">
          <h2 className="h1">Servisi (po OIB-u)</h2>
        </div>
        <div className="surface-body">
          <ServicerTable orgId={detail.id} servicers={detail.servicers} />
          <p className="mt-3 text-xs text-slate-500">
            „Prisilno uključi" aktivira servis bez odobrenja servisera (override). „Sakrij" uklanja
            servis iz vlasnikovog portala bez brisanja veze.
          </p>
        </div>
      </section>
    </main>
  );
}
