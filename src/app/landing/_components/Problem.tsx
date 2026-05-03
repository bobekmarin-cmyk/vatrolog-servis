const problems = [
  {
    emoji: "📄",
    title: "Papiri se gube i teško se pretražuju",
    before: "Prije: fascikli s nalozima, fotke na mobitelu, Excel koji svatko ima malo drugačiji.",
    after: "S VatroLog-om: svaki nalog, aparat i dokument na jednom mjestu, pretraživo u sekundi.",
  },
  {
    emoji: "⏰",
    title: "Rokovi servisa ispadaju iz fokusa",
    before: "Prije: ručno označavanje rokova, obavijesti kupcima kad se netko sjeti.",
    after: "S VatroLog-om: automatski podsjetnici i mjesečne liste rokova za svakog kupca.",
  },
  {
    emoji: "🧾",
    title: "Izvještaji i dostavnice troše sate",
    before: "Prije: prepisivanje iz bilježnice u Word, ručno slaganje upisnika i dostavnica.",
    after: "S VatroLog-om: PDF upisnik, dostavnica i mjesečni izvještaj generirani u jednom kliku.",
  },
];

export default function Problem() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
            Zašto VatroLog
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Servis vatrogasnih aparata zaslužuje bolji alat od Excela
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Znamo kako izgleda dan u radionici: aparat stiže, trebaš brzo znati kad je zadnji
            put servisiran, što je na njemu mijenjano i kome ide nazad. VatroLog to sve drži
            uredno i spremno za inspekciju.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {problems.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-2xl"
                aria-hidden
              >
                {p.emoji}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">{p.before}</p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
                {p.after}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
