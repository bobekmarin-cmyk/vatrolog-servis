export const metadata = { title: "Politika privatnosti — VatroLog" };

export default function PrivacyPage() {
  return (
    <article>
      <h1>Politika privatnosti</h1>
      <p className="text-sm text-slate-500">Zadnje ažuriranje: 20. travnja 2026.</p>

      <p>
        Ova Politika privatnosti opisuje kako platforma <strong>VatroLog</strong> (u daljnjem tekstu: „Usluga”) prikuplja, koristi, pohranjuje i štiti
        osobne podatke u skladu s Općom uredbom o zaštiti podataka (GDPR, Uredba EU 2016/679) i Zakonom o provedbi Opće uredbe o zaštiti podataka (NN 42/2018).
      </p>

      <h2>1. Voditelj obrade</h2>
      <p>
        Voditelj obrade je pružatelj usluge VatroLog. Za pitanja o privatnosti kontaktirajte našeg DPO-a na <a href="mailto:marin@vatrolog.com">marin@vatrolog.com</a>.
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
        Naši podizvršitelji (Stripe, Cloudflare R2, email provider) mogu obrađivati podatke izvan EU/EGP. U tim slučajevima primjenjujemo Standardne ugovorne klauzule (SCC) odobrene od Europske komisije.
      </p>

      <h2>6. Rokovi čuvanja</h2>
      <ul>
        <li>Podaci o aktivnom računu čuvaju se dok traje pretplata + 30 dana grace period za izvoz.</li>
        <li>Podaci o naplati i fakturama čuvaju se 11 godina (zakonska obveza).</li>
        <li>Sigurnosni logovi i audit log čuvaju se 12 mjeseci.</li>
        <li>Nakon brisanja, podaci se uklanjaju iz backupa u roku od 90 dana.</li>
      </ul>

      <h2>7. Vaša prava</h2>
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

      <h2>8. Kolačići (cookies)</h2>
      <p>
        Koristimo isključivo nužne kolačiće za održavanje sesije (<code>vb_session</code>, <code>vb_platform_session</code>, <code>vb_csrf</code>).
        Ne koristimo marketinške kolačiće ni trackere trećih strana bez vaše suglasnosti.
      </p>

      <h2>9. Sigurnost</h2>
      <p>
        Podaci se prenose isključivo preko HTTPS-a, lozinke se hashiraju bcrypt algoritmom (cost ≥ 12),
        pristup bazi je ograničen na produkcijske servere, rate limiting štiti od brute-force napada.
      </p>

      <h2>10. Kontakt</h2>
      <p>Za ostvarivanje prava ili pitanja: <a href="mailto:marin@vatrolog.com">marin@vatrolog.com</a>.</p>
    </article>
  );
}
