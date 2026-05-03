export const metadata = { title: "Ugovor o obradi podataka (DPA) — VatroLog" };

export default function DpaPage() {
  return (
    <article>
      <h1>Ugovor o obradi osobnih podataka (DPA)</h1>
      <p className="text-sm text-slate-500">Sastavni dio Uvjeta korištenja. Zadnje ažuriranje: 20. travnja 2026.</p>

      <p>
        Ovim Ugovorom o obradi podataka (u daljnjem tekstu: „DPA”) uređuje se odnos između <strong>Kupca</strong> kao voditelja obrade
        i <strong>VatroLog-a</strong> kao izvršitelja obrade, u smislu članka 28. GDPR-a.
      </p>

      <h2>1. Predmet obrade</h2>
      <p>
        VatroLog obrađuje osobne podatke u ime Kupca isključivo radi pružanja ugovorene SaaS usluge (evidencija servisa, izdavanje upisnika i računa, obavijesti).
      </p>

      <h2>2. Trajanje obrade</h2>
      <p>Obrada traje tijekom trajanja pretplate Kupca + 30 dana grace period za izvoz podataka.</p>

      <h2>3. Vrste osobnih podataka i kategorije ispitanika</h2>
      <ul>
        <li>Kontakt podaci kupaca Kupca (ime, adresa, email, telefon, OIB).</li>
        <li>Podaci djelatnika Kupca koji se prijavljuju u aplikaciju.</li>
        <li>Podaci o servisiranim aparatima i uslugama.</li>
      </ul>

      <h2>4. Obveze izvršitelja obrade (VatroLog)</h2>
      <ul>
        <li>Obrađuje podatke samo po dokumentiranim uputama Kupca.</li>
        <li>Osigurava povjerljivost osoba koje pristupaju podacima.</li>
        <li>Implementira odgovarajuće tehničke i organizacijske mjere (šifriranje u prijenosu, hashiranje lozinki, RBAC, audit log, rate limiting, backupi).</li>
        <li>Obavještava Kupca bez odgode u slučaju povrede osobnih podataka (najkasnije 72 sata).</li>
        <li>Pomaže Kupcu u odgovaranju na zahtjeve ispitanika (pristup, ispravak, brisanje, prenosivost).</li>
        <li>Po raskidu briše ili vraća sve osobne podatke Kupcu (osim ako propis nalaže čuvanje).</li>
      </ul>

      <h2>5. Podizvršitelji</h2>
      <p>Kupac ovim DPA-om daje opće odobrenje za angažman sljedećih podizvršitelja:</p>
      <table className="not-prose w-full text-sm border border-slate-200">
        <thead className="bg-slate-100">
          <tr><th className="p-2 text-left border-b">Podizvršitelj</th><th className="p-2 text-left border-b">Svrha</th><th className="p-2 text-left border-b">Lokacija</th></tr>
        </thead>
        <tbody>
          <tr><td className="p-2 border-b">Vercel Inc.</td><td className="p-2 border-b">Hosting aplikacije</td><td className="p-2 border-b">EU (Frankfurt)</td></tr>
          <tr><td className="p-2 border-b">Cloudflare Inc.</td><td className="p-2 border-b">CDN i R2 object storage</td><td className="p-2 border-b">EU / globalno</td></tr>
          <tr><td className="p-2 border-b">Stripe Inc.</td><td className="p-2 border-b">Naplata pretplate</td><td className="p-2 border-b">Irska / SAD (SCC)</td></tr>
          <tr><td className="p-2 border-b">Sentry</td><td className="p-2 border-b">Error tracking</td><td className="p-2 border-b">EU</td></tr>
          <tr><td className="p-2 border-b">Upstash</td><td className="p-2 border-b">Redis rate limiting</td><td className="p-2 border-b">EU</td></tr>
          <tr><td className="p-2">Google LLC (Gmail API)</td><td className="p-2">Slanje transakcijskih emailova (tenant opcionalno)</td><td className="p-2">Globalno (SCC)</td></tr>
        </tbody>
      </table>
      <p>O promjenama podizvršitelja obavještavamo Kupca najmanje 30 dana unaprijed uz pravo prigovora.</p>

      <h2>6. Prijenos u treće zemlje</h2>
      <p>
        Gdje se podaci prenose izvan EU/EGP, primjenjuju se Standardne ugovorne klauzule (2021/914/EU) ili druga odgovarajuća zaštita.
      </p>

      <h2>7. Revizija</h2>
      <p>
        Kupac može jednom godišnje zatražiti dokaze usklađenosti (izvještaj o sigurnosnim mjerama, SOC 2 ili usporedivi izvještaj).
      </p>

      <h2>8. Odgovornost</h2>
      <p>Odgovornost stranaka uređena je u skladu s člankom 82. GDPR-a i primjenjivim zakonima Republike Hrvatske.</p>

      <h2>9. Stupanje na snagu</h2>
      <p>DPA stupa na snagu prihvaćanjem Uvjeta korištenja prilikom registracije.</p>
    </article>
  );
}
