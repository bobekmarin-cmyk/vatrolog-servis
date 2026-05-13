export const metadata = {
  title: "Politika privatnosti — VatroLog",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <article>
      <h1>Politika privatnosti</h1>
      <p className="text-sm text-slate-500">Zadnje ažuriranje: 13. svibnja 2026.</p>

      <p>
        Ova Politika privatnosti opisuje kako platforma <strong>VatroLog</strong> (u daljnjem tekstu: „Usluga”) prikuplja, koristi, pohranjuje i štiti
        osobne podatke u skladu s Općom uredbom o zaštiti podataka (GDPR, Uredba EU 2016/679) i Zakonom o provedbi Opće uredbe o zaštiti podataka (NN 42/2018).
      </p>

      <h2>1. Voditelj obrade</h2>
      <p>
        Voditelj obrade je <strong>Via Madera d.o.o.</strong> (OIB: 40918539877), pružatelj usluge VatroLog.
        Za pitanja o privatnosti kontaktirajte našeg DPO-a na <a href="mailto:info@vatrolog.com">info@vatrolog.com</a>{" "}
        ili telefonom <a href="tel:+385976123983">097 612 3983</a>.
      </p>

      <h2>2. Koje podatke prikupljamo</h2>
      <ul>
        <li><strong>Podaci o računu:</strong> email, ime i prezime, hash lozinke, rola (admin/workshop).</li>
        <li><strong>Podaci o tvrtki:</strong> naziv, OIB, adresa, kontakt podaci.</li>
        <li><strong>Podaci o kupcima:</strong> naziv, OIB, adresa, kontakt osoba, email, telefon (unose ih korisnici Usluge kao voditelji obrade).</li>
        <li><strong>Tehnički podaci:</strong> IP adresa, user agent, vrijeme pristupa (u sigurnosnim i audit logovima).</li>
        <li><strong>Plaćanje:</strong> obrađuje <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe</a>; mi ne pohranjujemo brojeve kartica.</li>
      </ul>

      <h2>3. Svrhe i pravna osnova obrade</h2>
      <ul>
        <li><strong>Pružanje Usluge</strong> (pravna osnova: izvršenje ugovora, čl. 6(1)(b) GDPR).</li>
        <li><strong>Naplata i računovodstvo</strong> (zakonska obveza, čl. 6(1)(c)).</li>
        <li><strong>Sigurnost i sprječavanje prijevara</strong> (legitimni interes, čl. 6(1)(f)).</li>
        <li><strong>Obavijesti o isteku pretplate i transakcijski emailovi</strong> (izvršenje ugovora).</li>
      </ul>

      <h2>4. VatroLog kao izvršitelj obrade</h2>
      <p>
        U odnosu na podatke koje naši korisnici (tvrtke servisi) unose u Uslugu (njihovi kupci, kontakti), VatroLog djeluje kao <em>izvršitelj obrade</em>.
        Detalji su uređeni ugovorom o obradi podataka (<a href="/legal/dpa">DPA</a>) koji je sastavni dio Uvjeta korištenja.
      </p>

      <h2>5. Prijenos podataka u treće zemlje</h2>
      <p>
        Naši podizvršitelji (Stripe, Cloudflare R2, Google LLC za Gmail integraciju, ostali email provideri) mogu
        obrađivati podatke izvan EU/EGP. U tim slučajevima primjenjujemo Standardne ugovorne klauzule (SCC)
        odobrene od Europske komisije.
      </p>

      <h2 id="google-api">6. Google API Services i Gmail integracija</h2>
      <p>
        VatroLog nudi opcionalnu Gmail integraciju kojom korisnik može povezati svoj Google račun radi slanja
        servisnih dokumenata (servisni nalog, primka, upisnik, otpremnica) i obavijesti svojim kupcima izravno iz
        aplikacije. Korištenje Gmail integracije u potpunosti je dobrovoljno; bez nje aplikacija radi preko SMTP-a
        ili vendor maila.
      </p>
      <p>
        VatroLog koristi <strong>Google API Services</strong> i obvezuje se na ponašanje sukladno{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , uključujući zahtjeve <strong>Limited Use</strong>.
      </p>
      <p>
        <strong>Pristupi (OAuth scopeovi)</strong> koje aplikacija traži pri povezivanju Gmaila:
      </p>
      <ul>
        <li>
          <code>https://www.googleapis.com/auth/gmail.send</code> — slanje e-mail poruka iz korisničkog Gmail
          računa (servisni dokumenti, obavijesti kupcima).
        </li>
        <li>
          <code>https://www.googleapis.com/auth/userinfo.email</code> — prikaz adrese povezanog Google računa
          korisniku radi kontrole i vidljivosti koja je adresa spojena s VatroLogom.
        </li>
      </ul>
      <p>
        <strong>Što VatroLog radi s Gmail podacima:</strong> spremamo OAuth tokene (access i refresh token)
        povezane s vašim Google računom u našoj bazi u <em>enkriptiranom obliku</em> i koristimo ih isključivo za
        slanje poruka koje vi ili automatizmi konfigurirani u vašoj radionici eksplicitno pokrenete. Adresu
        povezanog računa prikazujemo u sučelju aplikacije kako bi bilo jasno koja je adresa spojena.
      </p>
      <p>
        <strong>Što VatroLog NE radi s Gmail podacima:</strong>
      </p>
      <ul>
        <li>ne čitamo i ne indeksiramo Gmail inbox, nacrte, poslane poruke ni bilo koje druge poštanske mape;</li>
        <li>ne preuzimamo, kopiramo niti pohranjujemo poruke koje primite ili pošaljete u svom Gmail računu;</li>
        <li>ne dijelimo Gmail podatke s trećim stranama;</li>
        <li>
          ne koristimo Gmail podatke za prikaz oglasa, profiliranje korisnika niti za treniranje modela
          umjetne inteligencije (AI/ML);
        </li>
        <li>
          ljudski pristup Gmail podacima je ograničen na slučajeve eksplicitne suglasnosti korisnika u svrhu
          podrške, sigurnosti ili kad je to zakonski obvezno.
        </li>
      </ul>
      <p>
        <strong>Opoziv pristupa:</strong> u svakom trenutku možete odspojiti Gmail iz aplikacije
        (Postavke → Mail → „Odspoji Gmail”) — na taj način brišemo OAuth tokene iz naše baze i opozivamo refresh
        token kod Googlea. Pristup možete dodatno opozvati i izravno na svom Google računu putem{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          myaccount.google.com/permissions
        </a>
        .
      </p>
      <p>
        Više detalja o tehničkoj strani Gmail integracije i scopeovima dostupno je na stranici{" "}
        <a href="/legal/google-api">Gmail integracija (Google API)</a>.
      </p>

      <h2>7. Rokovi čuvanja</h2>
      <ul>
        <li>Podaci o aktivnom računu čuvaju se dok traje pretplata + 30 dana grace period za izvoz.</li>
        <li>Podaci o naplati i fakturama čuvaju se 11 godina (zakonska obveza).</li>
        <li>Sigurnosni logovi i audit log čuvaju se 12 mjeseci.</li>
        <li>Nakon brisanja, podaci se uklanjaju iz backupa u roku od 90 dana.</li>
      </ul>

      <h2>8. Vaša prava</h2>
      <p>Sukladno GDPR-u imate pravo na:</p>
      <ul>
        <li>pristup podacima (DSAR izvoz dostupan je unutar aplikacije na <a href="/admin/privacy">Postavke privatnosti</a>),</li>
        <li>ispravak netočnih podataka,</li>
        <li>brisanje („pravo na zaborav”) — moguće putem Postavki privatnosti ili na zahtjev,</li>
        <li>ograničenje obrade,</li>
        <li>prenosivost podataka (JSON/CSV izvoz),</li>
        <li>prigovor protiv obrade temeljene na legitimnom interesu,</li>
        <li>podnošenje pritužbe AZOP-u (<a href="https://azop.hr" target="_blank" rel="noopener noreferrer">azop.hr</a>).</li>
      </ul>

      <h2>9. Kolačići (cookies)</h2>
      <p>
        Koristimo isključivo nužne kolačiće za održavanje sesije (<code>vb_session</code>, <code>vb_platform_session</code>, <code>vb_csrf</code>).
        Ne koristimo marketinške kolačiće ni trackere trećih strana bez vaše suglasnosti.
      </p>

      <h2>10. Sigurnost</h2>
      <p>
        Podaci se prenose isključivo preko HTTPS-a, lozinke se hashiraju bcrypt algoritmom (cost ≥ 12),
        pristup bazi je ograničen na produkcijske servere, rate limiting štiti od brute-force napada. OAuth
        tokeni (uključujući Gmail tokene) i SMTP zaporke pohranjuju se u bazi u enkriptiranom obliku
        (AES-256-GCM) s ključem koji nije vidljiv aplikacijskom korisniku. Svako slanje e-pošte i svaka
        promjena na integracijama bilježi se u <em>EmailLog</em> i <em>AuditLog</em> evidencijama radi
        sljedivosti.
      </p>

      <h2>11. Kontakt</h2>
      <p>
        Za ostvarivanje prava ili pitanja: <a href="mailto:info@vatrolog.com">info@vatrolog.com</a>{" "}
        ili <a href="tel:+385976123983">097 612 3983</a>.
      </p>
    </article>
  );
}
