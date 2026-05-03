import Link from "next/link";
import { IconCheck, IconBolt } from "./icons";

const included = [
  "Neograničen broj naloga",
  "Neograničeno aparata u evidenciji",
  "PDF upisnici i dostavnice",
  "Skladište i primke dijelova",
  "Gmail integracija za slanje dokumenata",
  "Javni portal za kupce (tajni link)",
  "Višekorisnički pristup (admin + radionica)",
  "E-mail podrška tijekom testiranja",
];

export default function Pricing() {
  return (
    <section id="cijene" className="py-20 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
            Cijene
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            14 dana probnog rada uz ručno odobrenje — bez kartice
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Pošaljete zahtjev, mi ga pregledamo i u roku 1 radnog dana šaljemo
            pozivnicu putem koje sami postavljate korisnička imena i lozinke. Tek
            tada počinje 14-dnevni probni rad. Nastavak korištenja dogovaramo
            osobno, uz early-bird uvjete za prve servisere.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-3">
          <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-900 p-8 text-white shadow-xl lg:col-span-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200 ring-1 ring-red-400/40">
                <IconBolt className="h-3.5 w-3.5" />
                Early-bird trial
              </span>
              <span className="text-xs text-slate-400">Trenutno dostupno</span>
            </div>
            <h3 className="mt-5 text-2xl font-bold">Puni pristup tijekom probnog rada</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight">0 €</span>
              <span className="text-slate-400">/ 14 dana, bez kartice</span>
            </div>
            <p className="mt-3 max-w-md text-sm text-slate-300">
              Po odobrenju zahtjeva svi ključni moduli su otključani. Nakon
              probnog rada nastavak dogovaramo direktno, uz early-bird uvjete
              za prve korisnike.
            </p>

            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {included.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-200">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Zatraži probni pristup
              </Link>
              <a
                href="#kontakt"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10"
              >
                Dogovori early-bird
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Nakon testiranja</h3>
            <p className="mt-2 text-sm text-slate-600">
              Planiramo jednostavnu mjesečnu pretplatu po servisnom poslovanju, bez skrivenih
              troškova.
            </p>
            <ul className="mt-5 space-y-3 text-sm">
              <li className="flex items-start gap-2 text-slate-700">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Cijena vezana uz jedan servisni subjekt (OIB)
              </li>
              <li className="flex items-start gap-2 text-slate-700">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Bez ograničenja broja aparata i naloga
              </li>
              <li className="flex items-start gap-2 text-slate-700">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Otkazivanje u svakom trenutku
              </li>
            </ul>
            <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              Finalne tarife objavljujemo po izlasku iz bete. Rani partneri zadržavaju
              početne uvjete.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
