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
    <section id="kako-radi" className="relative py-20 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-700">
            Kako radi
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
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
            className="absolute left-0 right-0 top-7 hidden h-0.5 bg-gradient-to-r from-transparent via-red-300 to-transparent md:block"
          />
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-lg hover:shadow-red-500/10"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-red-500/0 via-red-500/70 to-red-500/0 opacity-0 transition group-hover:opacity-100"
              />
              <div className="flex items-center gap-3">
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 text-sm font-extrabold text-white shadow-lg shadow-slate-900/20 ring-2 ring-red-500/70">
                  <span className="bg-gradient-to-br from-white via-red-200 to-red-400 bg-clip-text text-transparent">
                    {s.n}
                  </span>
                </span>
                <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{s.description}</p>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-3 top-12 hidden text-red-400 md:block"
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
