const stats = [
  {
    value: "QR kod",
    label: "Sekunda po aparatu umjesto ručnog unosa",
    detail:
      "Ako kroz radionicu prođe 50 aparata dnevno, samo čitanje i unos serijskog broja i godine proizvodnje uzima vrijeme. Uz QR sken podaci su u nalogu u isti tren.",
  },
  {
    value: "Dokumentacija",
    label: "Otpremnice i upisnici u jednom kliku",
    detail:
      "Pisanje dvadeset otpremnica i upisnika tjedno odzima barem 20 sati mjesečno. Fokusiraj se na servis, ne na pisanje.",
  },
  {
    value: "Obavijesti",
    label: "Skupna e-pošta umjesto poziva",
    detail:
      "Ako danas zoveš ili ručno pišeš mail da im je ovaj mjesec servis, to rješavaš jednom radnjom: automatski obavijestiš sve kupce kojima se bliži rok servisa aparata.",
  },
  {
    value: "Stanje zaliha",
    label: "Dijelovi i naljepnice po proizvođaču",
    detail:
      "Pratiš potrošene rezervne dijelove i evidencijske naljepnice po proizvođaču ili uvozniku, uz katalog s točnim tvorničkim šiframa. Kad zaliha padne ispod minimuma koji si definirao, aplikacija te odmah upozori.",
  },
];

export default function Benefits() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(220,38,38,0.18) 0%, rgba(15,23,42,0) 45%), radial-gradient(40rem 24rem at 100% 0%, rgba(244,63,94,0.18), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent"
      />

      <div className="mx-auto max-w-[90rem] px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-300">
            Učinak
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Vrijeme koje odmah vraćaš serviserima
          </h2>
          <p className="mt-4 text-base text-slate-300">
            Najveća ušteda nije u papiru, nego u minutama koje svaki dan odlaze na unos,
            prepisivanje, traženje podataka i slanje dokumenata.
          </p>
        </div>

        <dl className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, idx) => (
            <div
              key={s.label}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 shadow-xl transition hover:border-red-400/40 xl:p-6"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-red-500/15 blur-3xl transition group-hover:bg-red-500/25"
              />
              <span className="text-[11px] font-semibold tracking-widest text-red-400/80">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <dt className="mt-1 whitespace-nowrap bg-gradient-to-br from-white via-red-200 to-red-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent xl:text-4xl">
                {s.value}
              </dt>
              <dd className="mt-2 whitespace-nowrap text-[13px] font-semibold text-white xl:text-sm">
                {s.label}
              </dd>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{s.detail}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
