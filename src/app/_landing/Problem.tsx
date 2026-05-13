const problems = [
  {
    emoji: "📄",
    title: "Papiri se gube i teško se pretražuju",
    before:
      "Prije: fascikl ili bilježnica s nalozima, ručno prepisivanje u Excel i traženje podataka po papirima.",
    after:
      "S VatroLog-om: svaki nalog, aparat i dokument na jednom mjestu, uredno povezan i pretraživ u sekundi.",
  },
  {
    emoji: "⏰",
    title: "Rokovi servisa ispadaju iz fokusa",
    before:
      "Prije: ručno praćenje rokova, parcijalno obavještavanje kupaca i stalna provjera Excel tablica.",
    after:
      "S VatroLog-om: automatski podsjetnici mailom kupcu o nadolazećem servisu. U jednom prikazu vidljiv je raspored servisiranja po mjesecima ili popis zaostataka.",
  },
  {
    emoji: "🧾",
    title: "Otpremnice i upisnici troše sate",
    before:
      "Prije: prepisivanje iz naloga ili bilježnice u Excel, ručni ispis, slanje kupcu i arhiviranje.",
    after:
      "S VatroLog-om: servisna primka, otpremnica ili upisnik automatski se generira kao PDF za ispis ili slanje mailom iz programa.",
  },
];

export default function Problem() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(60rem 30rem at 15% 0%, rgba(239,68,68,0.20), transparent 60%), radial-gradient(50rem 28rem at 85% 100%, rgba(244,63,94,0.18), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-300">
            Zašto VatroLog
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Servis vatrogasnih aparata zaslužuje bolji alat od Excela
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            U servisu je puno aparata od puno različitih kupaca — teško je znati što prvo
            servisirati, a uz sam servis još trebaš ručno pisati otpremnice i upisnike. VatroLog
            drži red u podacima i dokumentima da se možeš fokusirati na aparate, ne na papir.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {problems.map((p) => (
            <div
              key={p.title}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-lg backdrop-blur-sm transition hover:border-red-400/40 hover:bg-white/[0.06]"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-3xl transition group-hover:bg-red-500/20"
              />
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/15 text-2xl ring-1 ring-red-400/30"
                aria-hidden
              >
                {p.emoji}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{p.before}</p>
              <p className="mt-3 border-t border-white/10 pt-3 text-sm font-medium leading-relaxed text-slate-100">
                <span className="mr-1 text-red-400">→</span>
                {p.after}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
