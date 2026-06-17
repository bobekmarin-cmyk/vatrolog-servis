import Link from "next/link";
import { redirect } from "next/navigation";
import VatroLogLogo from "@/components/VatroLogLogo";
import { getOwnerSession } from "@/lib/ownerAuth";
import OwnerLoginForm from "./OwnerLoginForm";

export const metadata = {
  title: "Korisnički portal — prijava",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function OwnerLoginPage() {
  const session = await getOwnerSession();
  if (session) redirect("/korisnik");

  return (
    <main className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm surface p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <VatroLogLogo size="lg" />
        </div>
        <h1 className="text-2xl font-bold">Korisnički portal</h1>
        <p className="mt-1 text-sm text-slate-600">Prijava za vlasnike vatrogasnih aparata.</p>

        <div className="mt-6">
          <OwnerLoginForm />
        </div>

        <div className="mt-4 text-xs text-slate-500">
          <Link href="/korisnik/forgot-password" className="hover:text-red-600 hover:underline">
            Zaboravljena lozinka?
          </Link>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Pristup portalu dobivate pozivnicom od svog servisa. Ako je niste primili, obratite se servisu.
        </p>
      </div>
    </main>
  );
}
