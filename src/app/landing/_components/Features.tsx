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
    title: "Servisni nalozi",
    description:
      "Periodični i internalni nalozi s katalogom usluga, zaključavanjem, potpisom i PDF izdanjem.",
    Icon: IconClipboard,
  },
  {
    title: "Evidencija aparata",
    description:
      "Svaki aparat povezan s kupcem i odjelom, statusom, rokovima i povijesti servisa.",
    Icon: IconFireExt,
  },
  {
    title: "QR kodovi na aparatima",
    description:
      "Ispis QR naljepnica za brzu identifikaciju i uvid u aparat iz radionice ili na terenu.",
    Icon: IconShield,
  },
  {
    title: "Skladište i primke",
    description:
      "Stanja rezervnih dijelova po šifri, ulazne primke dobavljača i automatsko skidanje sa stanja na nalogu.",
    Icon: IconBox,
  },
  {
    title: "Kupci i javni portal",
    description:
      "Matica kupaca s odjelima i lokacijama; opcionalni portal s tajnim linkom gdje kupac vidi svoje aparate.",
    Icon: IconUsers,
  },
  {
    title: "Izvještaji i rokovi",
    description:
      "Mjesečni rasporedi i zaostaci, lista kupaca s predstojećim rokovima — bez ručnog filtriranja.",
    Icon: IconChart,
  },
  {
    title: "Slanje e-maila iz alata",
    description:
      "Spoji Gmail i pošalji ponudu, upisnik ili dostavnicu kupcu bez izlaska iz VatroLog-a.",
    Icon: IconMail,
  },
  {
    title: "Upisnik i dostavnica (PDF)",
    description:
      "Službeni PDF-ovi potrebni za zapisnik o servisu i predaju aparata — spremni za ispis ili slanje.",
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
            Dizajnirano zajedno s aktivnim serviserima. Bez suvišnih polja, s jasnim tokom
            posla od primitka aparata do izdavanja dokumenata.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Dokumenti pomažu u urednom vođenju evidencije prema hrvatskim pravilima struke;
            pravnu usklađenost postupka i podatke na dokumentima potvrđuje servis.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ title, description, Icon }) => (
            <div
              key={title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
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
