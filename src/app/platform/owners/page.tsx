import Link from "next/link";
import { requirePlatformSession } from "@/lib/platformAuth";
import { listOwnerOrgs } from "@/lib/platformOwners";

export const dynamic = "force-dynamic";

export default async function PlatformOwnersPage() {
  await requirePlatformSession();
  const orgs = await listOwnerOrgs();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vlasnici (portal)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vlasnici aparata grupirani po OIB-u (korisnički portal). Vidite status portala, račune i
          servisere te upravljate vidljivošću i pozivnicama. Zapisi kupaca po serviseru su na
          Kupci (po serviseru).
        </p>
      </div>

      <section className="surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Vlasnik / OIB</th>
              <th className="px-4 py-2">Portal</th>
              <th className="px-4 py-2">Računi</th>
              <th className="px-4 py-2">Servisi (aktivni/ukupno)</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{o.name ?? "—"}</div>
                  <div className="font-mono text-xs text-slate-500">{o.oib}</div>
                </td>
                <td className="px-4 py-3">
                  {o.portalActive ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Aktivan</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Neaktivan</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {o.verifiedAccountCount}/{o.accountCount}
                </td>
                <td className="px-4 py-3">
                  {o.activeServicerCount}/{o.totalServicerCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/platform/owners/${o.id}`} className="text-blue-700 hover:underline">
                    Detalji →
                  </Link>
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Još nema vlasnika s korisničkim portalom.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
