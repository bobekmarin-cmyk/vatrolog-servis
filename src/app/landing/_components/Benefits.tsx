const stats = [
  {
    value: "Brže",
    label: "izdavanje naloga",
    detail: "Ručni unos zamijenjen brzom pretragom kupca, aparata i katalogom servisa.",
  },
  {
    value: "1 klik",
    label: "do PDF upisnika i dostavnice",
    detail: "Upisnik, dostavnica i mjesečni izvještaj spremni za slanje u PDF-u.",
  },
  {
    value: "QR",
    label: "na svakom aparatu",
    detail: "Naljepnica s QR kodom otvara povijest servisa i status aparata.",
  },
  {
    value: "Manje",
    label: "propuštenih rokova",
    detail: "Automatski podsjetnici kupcima i interni zaostaci prije isteka roka.",
  },
];

export default function Benefits() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Konkretne uštede koje osjetiš već prvi tjedan
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Manje administracije, više vremena za stvarni posao u radionici i na terenu.
          </p>
        </div>

        <dl className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm"
            >
              <dt className="text-4xl font-extrabold tracking-tight text-red-600">
                {s.value}
              </dt>
              <dd className="mt-2 text-sm font-semibold text-slate-900">{s.label}</dd>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.detail}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
