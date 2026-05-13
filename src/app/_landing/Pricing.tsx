import Link from "next/link";
import { IconCheck, IconBolt, IconSparkles } from "./icons";

const trialFeatures = [
  "Neograničen broj naloga i vatrogasnih aparata",
  "PDF primke, upisnici i otpremnice",
  "Integracija s vlastitim mailom (Gmail / SMTP)",
  "Višekorisnički pristup — administrator, radionica, servisno vozilo",
  "Skladište naljepnica i dijelova sa katalozima proizvođača",
  "Portal za kupce — link na koji kupac vidi sve svoje aparate",
  "Puna mail i telefonska podrška",
  "Detaljna statistika izvedenog rada — za svakog servisera",
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
            30 dana probnog rada — bez naplate, bez obaveza
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Pošaljete zahtjev, mi ga pregledamo isti radni dan i pripremamo vaše
            korisničke račune. Šaljemo pozivnicu na e-mail putem koje sami postavljate
            samo lozinke — i tek tada kreće 30 dana probnog rada, bez naplate i bez
            obaveza. Uz dogovor dolazimo s prezentacijom uživo na vašu lokaciju.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-5xl">
          <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-900 p-8 text-white shadow-xl sm:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200 ring-1 ring-red-400/40">
                <IconBolt className="h-3.5 w-3.5" />
                Probno razdoblje
              </span>
              <span className="text-xs text-slate-400">Trenutno aktivno</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
                <IconSparkles className="h-3.5 w-3.5" />
                Sve otključano
              </span>
            </div>

            <h3 className="mt-5 text-2xl font-bold sm:text-3xl">
              Puni pristup tijekom probnog rada
            </h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight">0 €</span>
              <span className="text-slate-400">
                / 30 dana, bez kartice, uz mogućnost besplatnog produljenja
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              U probnom razdoblju otključano je sve što program trenutno sadržava —
              kako biste stvarno isprobali tijek rada od primke do otpremnice. I
              nakon probnog rada program ostaje jedan paket sa svim funkcijama,
              uz ugovor i dogovorene uvjete korištenja.
            </p>

            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {trialFeatures.map((f) => (
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
                Dogovori prezentaciju uživo
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-5xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Nakon probnog rada
            </span>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Paket dogovaramo prema načinu rada vašeg servisa
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Nakon probnog rada ne guramo sve servise u isti model. Uvjeti korištenja i
              cijena dogovaraju se individualno, prema stvarnim potrebama kupca — broju
              korisničkih računa, servisnih vozila i načinu rada radionice.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Većina funkcija ostaje dostupna svima, a program uključuje redovna
              održavanja, zakonske prilagodbe i nadogradnje kataloga proizvođača, aparata,
              dijelova i naljepnica. Sa svakim servisnim subjektom sklapa se ugovor, a ako
              imate specifične zahtjeve, nastojat ćemo ih implementirati jer VatroLog
              gradimo zajedno sa servisima koji ga koriste.
            </p>
            <div className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Individualni dogovor</div>
                <p className="mt-1 text-slate-600">
                  Uvjeti prate veličinu servisa, broj korisnika i način rada.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Redovna ažuriranja</div>
                <p className="mt-1 text-slate-600">
                  Održavanje, zakonske promjene i stalno širenje kataloga.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Nadogradnje po potrebi</div>
                <p className="mt-1 text-slate-600">
                  Specifične zahtjeve pokušavamo pretvoriti u korisne funkcije.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
