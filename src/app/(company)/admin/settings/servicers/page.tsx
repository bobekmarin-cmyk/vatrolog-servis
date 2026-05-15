import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { FEATURE_KEYS, getCompanyFeatures, isFeatureEnabledForRole } from "@/lib/companyFeatures";
import { redirect } from "next/navigation";
import SetPinButton from "@/components/SetPinButton";

export default async function AdminSettingsServicersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/?forbidden=1");
  const features = await getCompanyFeatures(session.companyId);
  const allowed = isFeatureEnabledForRole(session.role, features, FEATURE_KEYS.ADMIN_SERVICERS);
  if (!allowed) redirect("/?forbidden=1");

  const users = await prisma.user.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ active: "desc" }, { fullName: "asc" }],
  });

  const activeUsers = users.filter((u) => u.active);
  const inactiveUsers = users.filter((u) => !u.active);

  return (
    <div className="space-y-6">
      <section className="surface">
        <div className="surface-header">
          <h2 className="h1">Dodaj servisera</h2>
        </div>
        <div className="surface-body">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" action="/api/admin/servicers/create" method="post">
            <div className="sm:col-span-2">
              <label className="label">Ime i prezime</label>
              <input className="input" name="fullName" placeholder="npr. Marin Bobek" required />
            </div>
            <div>
              <label className="label">PIN (4 znamenke)</label>
              <input className="input font-mono tracking-widest text-center" name="pin" type="password" inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="••••" required />
            </div>
            <div className="flex items-end">
              <button className="btn btn-primary px-4" type="submit">
                Spremi
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="surface">
        <div className="surface-header">
          <div>
            <h2 className="h1">Serviseri</h2>
            <p className="mt-1 subtle">Svaki serviser treba imati PIN za dnevnu prijavu.</p>
          </div>
          <span className="subtle">
            Aktivni: {activeUsers.length} · Neaktivni: {inactiveUsers.length}
          </span>
        </div>
        <div className="h-px bg-black/10" />

        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Ime i prezime</th>
                <th className="table-cell whitespace-nowrap">Status</th>
                <th className="table-cell">PIN</th>
                <th className="table-cell text-right">Akcija</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 ? (
                <tr>
                  <td className="table-cell table-muted" colSpan={4}>
                    Nema servisera.
                  </td>
                </tr>
              ) : null}

              {activeUsers.length > 0 ? (
                <tr className="bg-slate-50">
                  <td className="table-cell table-muted font-semibold" colSpan={4}>
                    Aktivni
                  </td>
                </tr>
              ) : null}
              {activeUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="table-cell table-strong">
                    <Link href={`/reports/operations/servicer/${u.id}`} className="hover:underline text-blue-700">
                      {u.fullName}
                    </Link>
                  </td>
                  <td className="table-cell">
                    <span className="badge badge-tight badge-success">Aktivan</span>
                  </td>
                  <td className="table-cell">
                    <SetPinButton servicerId={u.id} hasPin={!!u.pin} />
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-2">
                      <form action={`/api/admin/servicers/${u.id}/toggle`} method="post" className="inline">
                        <button className="btn btn-outline px-3 py-1 text-xs" type="submit">
                          Deaktiviraj
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}

              {inactiveUsers.length > 0 ? (
                <tr className="bg-slate-50">
                  <td className="table-cell table-muted font-semibold" colSpan={4}>
                    Neaktivni
                  </td>
                </tr>
              ) : null}
              {inactiveUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="table-cell">{u.fullName}</td>
                  <td className="table-cell">
                    <span className="badge badge-tight badge-neutral">Neaktivan</span>
                  </td>
                  <td className="table-cell">
                    <SetPinButton servicerId={u.id} hasPin={!!u.pin} />
                  </td>
                  <td className="table-cell text-right">
                    <form action={`/api/admin/servicers/${u.id}/toggle`} method="post" className="inline">
                      <button className="btn btn-outline px-3 py-1 text-xs" type="submit">
                        Aktiviraj
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
