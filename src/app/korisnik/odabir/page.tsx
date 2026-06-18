import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getOwnerMembershipOrgs } from "@/lib/ownerOrg";
import OwnerLogoutButton from "../(app)/OwnerLogoutButton";
import OwnerOrgPicker from "./OwnerOrgPicker";

export const metadata = {
  title: "Odabir tvrtke — Korisnički portal",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";

export default async function OwnerOrgSelectPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");

  const orgs = await getOwnerMembershipOrgs(session.ownerId);
  if (orgs.length === 0) redirect("/korisnik/login?nema-pristupa=1");

  return (
    <div className="min-h-dvh bg-gradient-to-b from-red-50/60 via-slate-50 to-slate-50">
      <header className="bg-gradient-to-br from-red-700 to-red-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 p-4">
          <div className="leading-tight">
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-white">Vatro</span>
              <span className="text-red-200">Log</span>
            </span>
            <div className="text-xs font-medium text-red-100">Korisnički portal</div>
          </div>
          <OwnerLogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Odaberite tvrtku</h1>
          <p className="mt-1 text-sm text-slate-600">
            Vaš račun ({session.email}) povezan je s više tvrtki. Odaberite kojoj želite pristupiti.
          </p>
        </div>
        <OwnerOrgPicker orgs={orgs} />
      </main>
    </div>
  );
}
