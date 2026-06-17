import Link from "next/link";
import { redirect } from "next/navigation";
import VatroLogLogo from "@/components/VatroLogLogo";
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
  try {
    const links = await getOwnerActiveLinks(session.ownerId);
    if (links.length > 0) {
      const exts = await getOwnerExtinguishers(links);
      const states = await getOwnerInspectionStates(session.ownerId, exts.map((e) => e.id));
      inspectionDueCount = [...states.values()].filter((s) => s.overdue).length;
    }
  } catch {
    inspectionDueCount = 0;
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-4">
          <Link href="/korisnik" className="shrink-0">
            <VatroLogLogo size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <div className="font-semibold text-slate-900">{session.name ?? session.email}</div>
              <div className="text-xs text-slate-500">Korisnički portal</div>
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
