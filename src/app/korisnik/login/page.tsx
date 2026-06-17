import Link from "next/link";
import { redirect } from "next/navigation";
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
    <main className="min-h-dvh flex items-center justify-center bg-slate-100 p-4 sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-2">
        {/* Lijevo: brending + opis */}
        <div className="flex flex-col justify-center gap-5 bg-gradient-to-br from-red-700 to-red-900 p-8 text-white sm:p-10">
          <div>
            <div className="text-3xl font-extrabold tracking-tight">
              <span className="text-white">Vatro</span>
              <span className="text-red-200">Log</span>
            </div>
            <div className="mt-1 text-sm font-medium text-red-100">Korisnički portal</div>
          </div>

          <h1 className="text-2xl font-bold leading-snug sm:text-3xl">
            Svi vaši vatrogasni aparati na jednom mjestu
          </h1>
          <p className="text-sm leading-relaxed text-red-50/90">
            Portal za vlasnike i korisnike vatrogasnih aparata. Pregledajte servisne naloge i dokumente,
            pratite rokove i vodite evidenciju redovnih (tromjesečnih) pregleda.
          </p>

          <ul className="space-y-2 text-sm text-red-50/90">
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 text-red-200">✓</span>
              Svi aparati i servisni nalozi, neovisno o servisu
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 text-red-200">✓</span>
              Primke, upisnici i otpremnice za preuzimanje
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 text-red-200">✓</span>
              Podsjetnici i unos redovnih pregleda
            </li>
          </ul>
        </div>

        {/* Desno: forma za prijavu */}
        <div className="flex flex-col justify-center p-8 sm:p-10">
          <h2 className="text-xl font-bold text-slate-900">Prijava</h2>
          <p className="mt-1 text-sm text-slate-600">Prijavite se za pristup svojim aparatima.</p>

          <div className="mt-6">
            <OwnerLoginForm />
          </div>

          <div className="mt-4 text-xs text-slate-500">
            <Link href="/korisnik/forgot-password" className="hover:text-red-600 hover:underline">
              Zaboravljena lozinka?
            </Link>
          </div>

          <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
            Pristup portalu dobivate pozivnicom od svog servisa. Ako je niste primili, obratite se servisu.
          </p>
        </div>
      </div>
    </main>
  );
}
