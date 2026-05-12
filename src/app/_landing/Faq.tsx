const faqs = [
  {
    q: "Tko može koristiti VatroLog?",
    a: "Servisne radionice i tvrtke koje periodično i internalno servisiraju vatrogasne aparate u Hrvatskoj. Podržan je rad s više korisnika (administrator i radionica), a svaki servisni subjekt (OIB) ima vlastiti prostor.",
  },
  {
    q: "Radi li na tabletu u radionici?",
    a: "Da. Sučelje je u potpunosti prilagođeno tabletima i mobitelu — skeniranje QR naljepnica, potpis kupca i ispis dostavnice rade iz preglednika, bez instalacije.",
  },
  {
    q: "Što s postojećim podacima iz Excela ili starog sustava?",
    a: "Pomažemo s uvozom osnovnih podataka (kupci, aparati, povijest servisa) iz Excel-a ili CSV-a. Za veće migracije dogovaramo pojedinačan uvoz u sklopu uvodnog razgovora.",
  },
  {
    q: "Kako stoji stvar s GDPR-om i zaštitom podataka?",
    a: "Podaci se obrađuju sukladno GDPR-u. Svaka tvrtka vidi isključivo svoje podatke, dostupni su nam ugovor o obradi podataka (DPA), Pravila privatnosti i Uvjeti korištenja.",
  },
  {
    q: "Kako započinje probni rad?",
    a: "Ispunite zahtjev za probni pristup. Pregledamo ga ručno (zbog različitih oblika servisnih subjekata — d.o.o., obrti, udruge — radije razgovaramo prije aktivacije) i u roku 1 radnog dana šaljemo pozivnicu na e-mail. Pozivnica vam omogućava da sami postavite korisnička imena i lozinke, i tek tada kreće 14-dnevni probni rad — bez kartice i automatske naplate.",
  },
  {
    q: "Postoji li podrška tijekom probnog rada?",
    a: "Da. Tijekom 14-dnevnog probnog rada podrška je dostupna putem e-maila i uvodnog poziva. Za prve korisnike radimo i asistirano postavljanje osnovnih podataka.",
  },
  {
    q: "Treba li mi internet u radionici?",
    a: "Da, VatroLog je web-aplikacija pa je potrebna internet veza. Radimo i na offline scenarijima za konkretne slučajeve u radionici — javi nam ako je to tebi ključno.",
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
