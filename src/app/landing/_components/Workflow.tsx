const steps = [
  {
    n: "01",
    title: "Primka",
    description:
      "Kupac dovozi aparate. Otvoriš nalog, skeniraš QR ili odabereš aparat iz evidencije, kupac potpiše primku.",
  },
  {
    n: "02",
    title: "Servis",
    description:
      "Odabereš tip servisa (periodični ili internalni), dodaš potrošene dijelove iz skladišta. Sve se automatski skida sa stanja.",
  },
  {
    n: "03",
    title: "Upisnik",
    description:
      "Generiraš PDF upisnika s pečatom i potpisom, arhiviraš ga i po potrebi pošalješ e-mailom kupcu izravno iz alata.",
  },
  {
    n: "04",
    title: "Dostava",
    description:
      "Ispišeš dostavnicu, označiš nalog dostavljenim, aparat dobiva novi rok. Podsjetnik za idući servis postavljen automatski.",
  },
];

export default function Workflow() {
  return (
    <section id="kako-radi" className="py-20 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
            Kako radi
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Od primitka aparata do predaje kupcu u četiri koraka
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Tijek posla iz stvarne radionice — logičan redoslijed, bez preklapanja ekrana i
            dvostrukog unosa.
          </p>
        </div>

        <ol className="relative mt-14 grid gap-6 md:grid-cols-4">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-red-200 to-transparent md:block"
          />
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white ring-4 ring-white">
                  {s.n}
                </span>
                <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{s.description}</p>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-3 top-12 hidden text-red-300 md:block"
                >
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
