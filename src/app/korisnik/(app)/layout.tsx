import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/ownerAuth";
import { getOwnerActiveLinks, getOwnerExtinguishers } from "@/lib/ownerPortalData";
import { getOwnerInspectionStates } from "@/lib/ownerInspections";
import OwnerLogoutButton from "./OwnerLogoutButton";
import OwnerNav from "./OwnerNav";

export const metadata = {
  title: "Korisnički portal",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";

export default async function OwnerAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getOwnerSession();
  if (!session) redirect("/korisnik/login");

  let inspectionDueCount = 0;
  let companyName: string | null = null;
  try {
    const links = await getOwnerActiveLinks(session.ownerId);
    companyName = links[0]?.customerName ?? null;
    if (links.length > 0) {
      const exts = await getOwnerExtinguishers(links);
      const states = await getOwnerInspectionStates(
        session.ownerId,
        exts.map((e) => ({ id: e.id, lastPeriodicAt: e.lastPeriodicAt })),
      );
      inspectionDueCount = [...states.values()].filter((s) => s.overdue).length;
    }
  } catch {
    inspectionDueCount = 0;
  }

  // Tvrtka (kupac) gore, ime korisnika ispod. Bez veza koristimo ime/email.
  const primaryName = companyName ?? session.name ?? session.email;
  const secondaryName = companyName && session.name ? session.name : null;

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
            <OwnerLogoutButton />
          </div>
        </div>
        <OwnerNav inspectionDueCount={inspectionDueCount} />
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 py-6">{children}</main>
    </div>
  );
}
