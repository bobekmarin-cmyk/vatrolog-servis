import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getActiveOwnerOrgId, isOwnerOrgAdmin, getOwnerOrgAccounts } from "@/lib/ownerOrg";
import OwnerAccountsManager from "./OwnerAccountsManager";

export const dynamic = "force-dynamic";

export default async function OwnerAccountsPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");
  const ownerOrgId = await getActiveOwnerOrgId(session.ownerId);
  if (!ownerOrgId) redirect("/korisnik/odabir");

  // Samo admin tvrtke upravlja računima.
  if (!(await isOwnerOrgAdmin(session.ownerId, ownerOrgId))) redirect("/korisnik");

  const { accounts, pending } = await getOwnerOrgAccounts(ownerOrgId, session.ownerId);

  return (
    <>
      <section>
        <h1 className="text-2xl font-bold text-slate-900">Korisnici</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upravljajte korisničkim računima svoje tvrtke. Pozovite kolege, dodijelite im ulogu (administrator ili član) i
          po potrebi povucite pristup. Svi računi vide iste aparate, naloge i dokumente vaše tvrtke.
        </p>
      </section>

      <OwnerAccountsManager
        accounts={accounts.map((a) => ({
          ownerId: a.ownerId,
          email: a.email,
          name: a.name,
          role: a.role,
          lastAccessAt: a.lastAccessAt ? a.lastAccessAt.toISOString() : null,
          isSelf: a.isSelf,
        }))}
        pending={pending.map((p) => ({
          email: p.email,
          role: p.role,
          invitedAt: p.invitedAt.toISOString(),
        }))}
      />
    </>
  );
}
