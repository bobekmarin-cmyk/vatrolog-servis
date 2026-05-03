import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import PrivacyActions from "./PrivacyActions";

export const metadata = { title: "Privatnost i GDPR" };

export default async function AdminPrivacyPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Privatnost i GDPR</h1>
        <p className="text-sm text-slate-600">Alati za ostvarivanje prava iz Opće uredbe o zaštiti podataka.</p>
      </div>

      <section className="surface p-6 space-y-3">
        <h2 className="text-lg font-semibold">Pravni dokumenti</h2>
        <ul className="list-disc ml-6 text-sm space-y-1">
          <li><Link href="/legal/terms" className="text-red-600 hover:underline" target="_blank">Uvjeti korištenja</Link></li>
          <li><Link href="/legal/privacy" className="text-red-600 hover:underline" target="_blank">Politika privatnosti</Link></li>
          <li><Link href="/legal/dpa" className="text-red-600 hover:underline" target="_blank">Ugovor o obradi podataka (DPA)</Link></li>
          <li><Link href="/legal/impressum" className="text-red-600 hover:underline" target="_blank">Impressum</Link></li>
        </ul>
      </section>

      <section className="surface p-6 space-y-3">
        <h2 className="text-lg font-semibold">Izvoz podataka (DSAR)</h2>
        <p className="text-sm text-slate-700">
          Preuzmite strojno čitljiv JSON izvoz svih podataka Vaše tvrtke — kupci, aparati, primke, radni nalozi, korisnici i serviseri.
          Koristite za prenosivost podataka, backup ili ispunjavanje prava ispitanika.
        </p>
        <PrivacyActions />
      </section>

      <section className="surface p-6 space-y-3 border-red-200">
        <h2 className="text-lg font-semibold text-red-700">Brisanje računa</h2>
        <p className="text-sm text-slate-700">
          Zahtjev za trajno brisanje svih podataka („pravo na zaborav”). Račun se odmah soft-briše i gubi pristup aplikaciji.
          Trajno brisanje iz aktivne baze i backupa izvršava se u roku od 90 dana.
        </p>
        <p className="text-sm text-slate-700">
          <strong>Napomena:</strong> podaci koje zakon nalaže čuvati (npr. izdani računi, fiskalni tragovi) zadržavaju se u skladu s propisima.
        </p>
      </section>
    </div>
  );
}
