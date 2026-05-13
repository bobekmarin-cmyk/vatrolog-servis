export const metadata = {
  title: "Gmail integracija (Google API) — VatroLog",
  description:
    "Detaljan opis Gmail integracije u VatroLogu: koji se Google scopeovi koriste (gmail.send, userinfo.email), Limited Use disclosure, što s podacima radimo, što ne radimo i kako odspojiti pristup.",
  alternates: { canonical: "/legal/google-api" },
};

export default function GoogleApiPage() {
  return (
    <article>
      <h1>Gmail integracija (Google API)</h1>
      <p className="text-sm text-slate-500">Zadnje ažuriranje: 13. svibnja 2026.</p>

      <p>
        VatroLog je SaaS aplikacija za servise vatrogasnih aparata. Korisnik aplikacije može <strong>opcionalno</strong>
        povezati svoj Google (Gmail) račun kako bi izravno iz aplikacije slao servisne dokumente
        (servisni nalog, primku, upisnik, otpremnicu) i obavijesti svojim kupcima. Bez povezivanja
        Gmaila aplikacija radi preko SMTP-a ili vendor maila — Gmail integracija nije obvezna za
        korištenje aplikacije.
      </p>

      <p>
        VatroLog koristi <strong>Google API Services</strong> i u potpunosti se obvezuje na ponašanje
        sukladno{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , uključujući zahtjeve <strong>Limited Use</strong>.
      </p>

      <h2>1. Koje Google scopeove tražimo i zašto</h2>
      <p>
        Pri povezivanju Gmaila Google će vam prikazati ekran sa zahtjevom za sljedećim pristupima
        (scopes). VatroLog ne traži više pristupa nego što je potrebno za prikazane funkcije.
      </p>
      <ul>
        <li>
          <strong>
            <code>https://www.googleapis.com/auth/gmail.send</code>
          </strong>
          {" "}— omogućuje aplikaciji slanje e-mail poruka iz vašeg Gmail računa. Koristi se isključivo
          kada vi (ili automatizam koji ste konfigurirali u svojoj radionici, npr. mjesečni
          podsjetnik kupcu) eksplicitno pokrenete slanje. Aplikacija nikada ne čita inbox, nacrte
          ni druge mape — ovaj scope tehnički daje samo pravo slanja, ne čitanja.
        </li>
        <li>
          <strong>
            <code>https://www.googleapis.com/auth/userinfo.email</code>
          </strong>
          {" "}— omogućuje aplikaciji da pročita adresu povezanog Google računa kako bismo vam u
          sučelju mogli prikazati koju adresu trenutno koristite kao odlaznu („Spojeno kao{" "}
          <em>vaše-ime@gmail.com</em>”). Ovo je važno radi vidljivosti i kontrole, a omogućuje vam i
          sigurno odspajanje točno onog računa koji je povezan.
        </li>
      </ul>

      <h2>2. Što VatroLog radi s Gmail podacima</h2>
      <ul>
        <li>
          OAuth tokene (access token i refresh token) koje nam Google izda spremamo u našu bazu u{" "}
          <strong>enkriptiranom obliku</strong> (AES-256-GCM, ključ izoliran od aplikacijskog koda).
        </li>
        <li>
          Tokene koristimo isključivo za slanje poruka koje vi pokrenete unutar VatroLoga
          (ručno klikom na „Pošalji”, ili automatizmom koji ste sami uključili — npr. mjesečni
          podsjetnik kupcima).
        </li>
        <li>
          E-mail adresu povezanog računa prikazujemo u sučelju aplikacije (Postavke → Mail) kako bi
          bilo jasno koja je adresa trenutno spojena.
        </li>
        <li>
          Svako slanje (uspješno i neuspješno) bilježimo u internoj evidenciji <em>EmailLog</em>
          {" "}(metapodaci: vrijeme slanja, primatelj, predmet, status), a svaku promjenu integracije
          u <em>AuditLog</em> evidenciji.
        </li>
      </ul>

      <h2>3. Što VatroLog NE radi s Gmail podacima (Limited Use)</h2>
      <p>
        Korištenje informacija primljenih kroz Google API-je sukladno je{" "}
        <strong>Google API Services User Data Policy</strong>, uključujući <strong>Limited Use</strong>
        {" "}zahtjeve. Konkretno:
      </p>
      <ul>
        <li>
          <strong>Ne čitamo</strong> i ne indeksiramo Gmail inbox, nacrte, poslane poruke ni bilo
          koje druge poštanske mape — scope <code>gmail.send</code> tehnički ni ne dopušta čitanje.
        </li>
        <li>
          <strong>Ne preuzimamo, kopiramo niti pohranjujemo</strong> tijela poruka koje primite ili
          pošaljete u svom Gmail računu.
        </li>
        <li>
          <strong>Ne dijelimo</strong> Gmail podatke s trećim stranama; ne prodajemo ih i ne
          prenosimo drugim entitetima osim potrebnoj produkcijskoj infrastrukturi (hosting, baza)
          opisanoj u <a href="/legal/dpa">DPA</a>.
        </li>
        <li>
          <strong>Ne koristimo</strong> Gmail podatke za prikaz oglasa, profiliranje korisnika niti
          za treniranje modela umjetne inteligencije (AI / ML).
        </li>
        <li>
          <strong>Ljudski pristup</strong> Gmail podacima dopušten je samo u uskim slučajevima:
          (a) kad nam to izričito odobrite radi tehničke podrške, (b) zbog sigurnosti (npr. provjera
          zlouporabe), (c) kada to nalaže primjenjivi propis ili (d) za internu agregiranu i
          anonimiziranu operativnu statistiku (broj uspješnih/neuspješnih slanja).
        </li>
      </ul>

      <h2>4. Limited Use disclosure (English)</h2>
      <p className="not-prose rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        VatroLog&apos;s use and transfer of information received from Google APIs to any other app
        will adhere to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We use the <code>gmail.send</code> scope only to
        send emails the user explicitly initiates from within VatroLog (service documents and
        customer notifications) and the <code>userinfo.email</code> scope only to display the
        connected Google account address back to the user. We do not read the user&apos;s mailbox,
        do not store message contents, do not share Google user data with third parties, do not use
        it for advertising, and do not use it to develop, improve or train generalized AI/ML models.
      </p>

      <h2>5. Kako se povezati i odspojiti</h2>
      <p>
        <strong>Povezivanje:</strong> u aplikaciji otvorite <em>Postavke → Mail</em> (ili, za
        operatera platforme, <em>Platform → Postavke → Vendor Gmail</em>) i kliknite{" "}
        <strong>Poveži Gmail</strong>. Bit ćete preusmjereni na Google ekran gdje možete pregledati
        točno koje pristupe tražimo i potvrditi povezivanje. Nakon potvrde vraćamo vas u VatroLog s
        prikazom adrese spojenog računa.
      </p>
      <p>
        <strong>Odspajanje (preporučeno):</strong> u istom ekranu (<em>Postavke → Mail</em>) kliknite{" "}
        <strong>Odspoji Gmail</strong>. Time iz naše baze brišemo vaše OAuth tokene i opozivamo
        refresh token kod Googlea, čime aplikacija gubi mogućnost slanja iz vašeg računa.
      </p>
      <p>
        <strong>Dodatni opoziv kod Googlea:</strong> u svakom trenutku možete izravno na svom Google
        računu opozvati VatroLog na{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          myaccount.google.com/permissions
        </a>
        . Time aplikacija odmah ostaje bez pristupa, neovisno o stanju u VatroLogu.
      </p>

      <h2>6. Sigurnost</h2>
      <ul>
        <li>Sva komunikacija s Google API-jima ide preko TLS-a (HTTPS).</li>
        <li>OAuth tokeni pohranjeni su <strong>at rest</strong> u enkriptiranom obliku (AES-256-GCM).</li>
        <li>Pristup produkcijskim sustavima ograničen je na ovlaštene operatere VatroLoga.</li>
        <li>Svako slanje i svaka promjena integracije bilježi se u internim evidencijama.</li>
      </ul>

      <h2>7. Kontakt</h2>
      <p>
        Za bilo kakva pitanja vezana uz Gmail integraciju, opseg pristupa, brisanje podataka ili
        sigurnosne incidente: <a href="mailto:info@vatrolog.com">info@vatrolog.com</a> ili{" "}
        <a href="tel:+385976123983">097 612 3983</a>. Više o općoj politici privatnosti i ulogama u
        obradi pogledajte u našoj <a href="/legal/privacy">Politici privatnosti</a> i{" "}
        <a href="/legal/dpa">DPA dokumentu</a>.
      </p>
    </article>
  );
}
