import {
  IconClipboard,
  IconFireExt,
  IconBox,
  IconUsers,
  IconChart,
  IconMail,
  IconFileText,
  IconShield,
} from "./icons";
import type { SVGProps } from "react";

type Feature = {
  title: string;
  description: string;
  Icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
};

const features: Feature[] = [
  {
    title: "Servisni nalog i primka",
    description:
      "Odaberi kupca, skeniraj QR kod aparata i nalog se popunjava podacima iz baze. Primku možeš odmah ispisati kupcu.",
    Icon: IconClipboard,
  },
  {
    title: "Evidencija aparata",
    description:
      "Proizvođač, tip, tvornički broj, godina proizvodnje, status, rokovi i povijest servisa uvijek su vezani uz kupca.",
    Icon: IconFireExt,
  },
  {
    title: "Katalog aparata",
    description:
      "Odaberi proizvođača i tip, unesi tvornički broj i godinu. Imamo bazu s aparatima svih proizvođača u Hrvatskoj. Svakom aparatu naznačen je medij (prah, pjena, CO₂, F klasa) kao i izvedba (bočica, stalni tlak).",
    Icon: IconShield,
  },
  {
    title: "Skladište dijelova i naljepnica",
    description:
      "Prati stvarno stanje dijelova i evidencijskih naljepnica, uz kataloge proizvođača i upozorenja ispod minimuma.",
    Icon: IconBox,
  },
  {
    title: "Baza kupaca",
    description:
      "Matica kupaca s odjelima i lokacijama. Kupcu možeš poslati link na kojem vidi popis svih svojih aparata.",
    Icon: IconUsers,
  },
  {
    title: "Izvještaji i rokovi",
    description:
      "Mjesečni raspored servisiranja, popis zaostataka i statistika izvedenog rada dostupni su bez ručnog filtriranja.",
    Icon: IconChart,
  },
  {
    title: "Obavijesti i e-mail",
    description:
      "Spoji vlastiti mail i šalji kupcima dokumente ili obavijesti o nadolazećem servisu izravno iz programa.",
    Icon: IconMail,
  },
  {
    title: "Upisnici i otpremnice",
    description:
      "Prema odrađenom servisu automatski generiraj PDF upisnik ili otpremnicu za ispis i slanje.",
    Icon: IconFileText,
  },
];

export default function Features() {
  return (
    <section id="znacajke" className="bg-slate-50 py-20 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
            Značajke
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Sve što servisu vatrogasnih aparata treba — u jednom alatu
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Dizajnirano zajedno sa serviserima. Bez suvišnih polja, s jasnim tokom posla od
            primitka aparata do izdavanja dokumenata.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ title, description, Icon }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 border-t-2 border-t-red-500/70 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-lg hover:shadow-red-500/10"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-red-500/0 blur-2xl transition group-hover:bg-red-500/15"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-50 to-red-100 text-red-600 ring-1 ring-red-200/80 transition group-hover:from-red-100 group-hover:to-red-200">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
