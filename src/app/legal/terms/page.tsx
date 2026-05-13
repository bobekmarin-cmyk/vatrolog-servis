export const metadata = {
  title: "Uvjeti korištenja — VatroLog",
  alternates: { canonical: "/legal/terms" },
};

export default function TermsPage() {
  return (
    <article>
      <h1>Uvjeti korištenja usluge VatroLog</h1>
      <p className="text-sm text-slate-500">Zadnje ažuriranje: 13. svibnja 2026.</p>

      <p>
        Ovi Uvjeti korištenja (u daljnjem tekstu: „Uvjeti”) reguliraju odnos između pružatelja usluge <strong>VatroLog</strong> (u daljnjem tekstu: „Pružatelj”) i
        poslovnog korisnika koji se pretplati na uslugu (u daljnjem tekstu: „Kupac”). Korištenjem Usluge Kupac potvrđuje da je pročitao i prihvaća ove Uvjete u cijelosti.
      </p>

      <h2>1. Usluga</h2>
      <p>
        VatroLog je SaaS (Software as a Service) platforma namijenjena servisima vatrogasnih aparata za evidenciju primki, radnih naloga,
        vatrogasnih aparata, upisnika periodičnih pregleda i izdavanje propisanih dokumenata.
      </p>

      <h2>2. Pretplata i naplata</h2>
      <p>
        Kupac može koristiti Uslugu nakon registracije i odabira plana pretplate. Svi pretplatnički planovi naplaćuju se mjesečno ili godišnje unaprijed.
        Cijene su naznačene u aplikaciji na stranici <a href="/admin/settings/billing">Pretplata</a>. Pretplata se automatski obnavlja sve dok je Kupac ne otkaže.
      </p>
      <p>
        Probni period (trial) u trajanju od 30 dana besplatan je i bez obveze. Nakon isteka trial-a pristup se zaključava dok Kupac ne aktivira plaćenu pretplatu.
      </p>

      <h2>3. Obveze Kupca</h2>
      <ul>
        <li>Kupac se obvezuje koristiti Uslugu u skladu s pozitivnim propisima Republike Hrvatske.</li>
        <li>Kupac je odgovoran za točnost podataka koje unosi u Uslugu.</li>
        <li>Kupac se obvezuje čuvati pristupne podatke u tajnosti i neovlaštene pristupe prijaviti Pružatelju bez odgode.</li>
        <li>Kupac ne smije pokušavati pristupiti podacima drugih korisnika ni reverzno inženjerstvo Usluge.</li>
      </ul>

      <h2>4. Obveze Pružatelja</h2>
      <ul>
        <li>Pružatelj se obvezuje na ciljanu dostupnost od 99.5% mjesečno (SLA).</li>
        <li>Pružatelj će provoditi sigurnosne nadogradnje i backupe podataka.</li>
        <li>Pružatelj jamči da podaci Kupca neće biti prodavani, iznajmljivani niti dijeljeni s trećim stranama bez izričitog pristanka.</li>
      </ul>

      <h2>5. Intelektualno vlasništvo</h2>
      <p>
        Sav softver i dokumentacija VatroLog-a intelektualno su vlasništvo Pružatelja. Kupac stječe samo pravo korištenja tijekom trajanja pretplate.
      </p>

      <h2>6. Integracije trećih strana (Gmail / Google API)</h2>
      <p>
        VatroLog nudi opcionalnu Gmail integraciju za slanje servisnih dokumenata i obavijesti kupcima iz
        korisničkog Gmail računa. Korištenje Gmail integracije podliježe i{" "}
        <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
          Google Uvjetima pružanja usluge
        </a>
        {" "}te{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , uključujući zahtjeve <strong>Limited Use</strong>. Detaljan opis obrade Gmail podataka, popis
        scopeova i način odspajanja opisani su u{" "}
        <a href="/legal/privacy#google-api">Politici privatnosti</a> i na javnoj stranici{" "}
        <a href="/legal/google-api">Gmail integracija</a>.
      </p>

      <h2>7. Odgovornost</h2>
      <p>
        Pružatelj nije odgovoran za štetu koja proizlazi iz pogrešno unesenih podataka, prekida u radu ISP-a, više sile ili neovlaštenog pristupa nastalog krivnjom Kupca.
      </p>

      <h2>8. Otkaz pretplate i brisanje podataka</h2>
      <p>
        Kupac u bilo kojem trenutku može otkazati pretplatu putem <a href="/admin/settings/billing">Stripe Customer Portala</a> ili kontaktiranjem podrške.
        Nakon otkaza Kupcu se omogućava pristup podacima još 30 dana radi izvoza (DSAR). Nakon toga se podaci trajno brišu s aktivnih sustava i backupa u roku od 90 dana,
        osim ako zakon ne nalaže duže čuvanje.
      </p>

      <h2>9. Izmjene uvjeta</h2>
      <p>
        Pružatelj može izmijeniti ove Uvjete s obaviješću Kupcu najmanje 30 dana prije stupanja na snagu. Nastavak korištenja smatra se prihvaćanjem.
      </p>

      <h2>10. Nadležni sud</h2>
      <p>Za sve sporove nadležan je stvarno nadležni sud u mjestu sjedišta Pružatelja.</p>

      <h2>11. Kontakt</h2>
      <p>
        Pružatelj usluge: <strong>Via Madera d.o.o.</strong>, OIB 40918539877.
        Za pitanja vezana uz ove Uvjete kontaktirajte{" "}
        <a href="mailto:info@vatrolog.com">info@vatrolog.com</a> ili{" "}
        <a href="tel:+385976123983">097 612 3983</a>.
      </p>
    </article>
  );
}
