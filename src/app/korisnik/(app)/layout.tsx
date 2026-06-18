import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getOwnerMembershipOrgs, getActiveOwnerOrgId, touchMembershipAccess } from "@/lib/ownerOrg";
import { getOwnerActiveLinks, getOwnerExtinguishers } from "@/lib/ownerPortalData";
import { getOwnerInspectionStates } from "@/lib/ownerInspections";
import OwnerLogoutButton from "./OwnerLogoutButton";
import OwnerNav from "./OwnerNav";
import OwnerOrgSwitcher from "./OwnerOrgSwitcher";

export const metadata = {
  title: "Korisnički portal",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";

export default async function OwnerAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");

  const orgs = await getOwnerMembershipOrgs(session.ownerId);
  if (orgs.length === 0) redirect("/korisnik/login?nema-pristupa=1");

  const activeOrgId = await getActiveOwnerOrgId(session.ownerId);
  if (!activeOrgId) redirect("/korisnik/odabir");

  void touchMembershipAccess(session.ownerId, activeOrgId);

  const activeOrg = orgs.find((o) => o.ownerOrgId === activeOrgId) ?? null;
  const isAdmin = activeOrg?.role === "ADMIN";

  let inspectionDueCount = 0;
  try {
    const links = await getOwnerActiveLinks(activeOrgId);
    if (links.length > 0) {
      const exts = await getOwnerExtinguishers(links);
      const states = await getOwnerInspectionStates(
        activeOrgId,
        exts.map((e) => ({ id: e.id, lastPeriodicAt: e.lastPeriodicAt })),
      );
      inspectionDueCount = [...states.values()].filter((s) => s.overdue).length;
    }
  } catch {
    inspectionDueCount = 0;
  }

  // Tvrtka (aktivni subjekt) gore, ime korisnika ispod.
  const primaryName = activeOrg?.name ?? activeOrg?.oib ?? session.name ?? session.email;
  const secondaryName = session.name ?? session.email;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-red-50/60 via-slate-50 to-slate-50">
      <header className="bg-gradient-to-br from-red-700 to-red-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-4">
          <Link href="/korisnik" className="shrink-0 leading-tight">
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-white">Vatro</span>
              <span className="text-red-200">Log</span>
            </span>
            <div className="text-xs font-medium text-red-100">Korisnički portal</div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm leading-tight sm:block">
              <div className="font-semibold text-white">{primaryName}</div>
              {secondaryName ? <div className="text-xs text-red-100/90">{secondaryName}</div> : null}
            </div>
            <OwnerOrgSwitcher orgs={orgs} activeOrgId={activeOrgId} />
            <OwnerLogoutButton />
          </div>
        </div>
        <OwnerNav inspectionDueCount={inspectionDueCount} isAdmin={isAdmin} />
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 py-6">{children}</main>
    </div>
  );
}
