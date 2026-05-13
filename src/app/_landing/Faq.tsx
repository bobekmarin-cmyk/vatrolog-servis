const faqs = [
  {
    q: "Tko može koristiti VatroLog?",
    a: "Svaki servis vatrogasnih aparata u Hrvatskoj. Podržan je rad s više korisnika, primjerice administrator, servisna radionica i servisno vozilo.",
  },
  {
    q: "Radi li na tabletu ili mobitelu?",
    a: "Da, radi na tabletu i mobitelu, ali za punu funkcionalnost preporučuje se stolno računalo. Za rad je uz računalo potreban još samo QR skener kodova, koji je besplatan uz potpisivanje ugovora.",
  },
  {
    q: "Što s postojećim podacima iz Excela ili starog sustava?",
    a: "Možemo pomoći s unosom popisa kupaca i osnovnih podataka za početak rada. Trenutno nema mogućnosti unosa starijih evidencija i radnih naloga iz prijašnjih sustava.",
  },
  {
    q: "Kako stoji stvar s GDPR-om i zaštitom podataka?",
    a: "Podaci se obrađuju sukladno GDPR-u. Svaka tvrtka vidi isključivo svoje podatke, dostupni su nam ugovor o obradi podataka (DPA), Pravila privatnosti i Uvjeti korištenja.",
  },
  {
    q: "Kako započinje probni rad?",
    a: "Ispunite zahtjev za probni pristup. Pregledamo ga ručno (zbog različitih oblika servisnih subjekata — d.o.o., obrti, vatrogasna društva — radije razgovaramo prije aktivacije) i u roku 1 radnog dana šaljemo pozivnicu na e-mail. Korisnička imena pripremamo mi, a vi putem pozivnice postavljate lozinke. Tek tada kreće 30-dnevni probni rad — bez kartice i automatske naplate. Uz dogovor možemo doći i s prezentacijom uživo na vašu lokaciju.",
  },
  {
    q: "Postoji li podrška tijekom probnog rada?",
    a: "Da. Podrška je dostupna uvijek i svima, tijekom probnog rada i kasnije, putem e-maila i telefona. Za prve korisnike radimo i asistirano postavljanje osnovnih podataka.",
  },
  {
    q: "Treba li mi internet u radionici?",
    a: "Da. VatroLog je web-aplikacija, za rad je potrebna internet veza i program će uvijek raditi online.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="bg-slate-50 py-20 scroll-mt-24">
      <div className="mx-auto max-w-4xl px-4">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
            FAQ
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Najčešća pitanja
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Ne vidiš odgovor na svoje pitanje? Piši nam — odgovaramo obično isti dan.
          </p>
        </div>

        <div className="mt-10 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {faqs.map((f) => (
            <details key={f.q} className="group px-6 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-slate-900">
                <span>{f.q}</span>
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-open:rotate-45 group-open:bg-red-50 group-open:text-red-600"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
