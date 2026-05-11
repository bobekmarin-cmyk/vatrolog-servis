export const metadata = {
  title: "Impressum — VatroLog",
  alternates: { canonical: "/legal/impressum" },
};

export default function ImpressumPage() {
  return (
    <article>
      <h1>Impressum</h1>

      <p>
        Sukladno Zakonu o elektroničkoj trgovini (NN 173/03, 67/08, 36/09, 130/11, 30/14, 32/19) i Zakonu o trgovačkim društvima,
        u nastavku se objavljuju podaci o pružatelju usluge.
      </p>

      <h2>Naziv pružatelja usluge</h2>
      <p>
        <strong>VatroLog</strong>
        <br />
        Usluga u pripremi za produkcijsko poslovanje.
      </p>

      <h2>Sjedište</h2>
      <p>
        Registarski podaci pružatelja usluge bit će objavljeni prije početka komercijalne
        naplate. Za beta i early-bird pristup koristi se kontakt u nastavku.
      </p>

      <h2>Kontakt</h2>
      <p>
        Email / podrška / DPO: <a href="mailto:marin@vatrolog.com">marin@vatrolog.com</a>
      </p>

      <h2>Registarski podaci</h2>
      <p>Podaci će biti dopunjeni prije javnog komercijalnog lansiranja.</p>

      <h2>Nadzorno tijelo</h2>
      <p>
        Agencija za zaštitu osobnih podataka (AZOP), Selska cesta 136, 10000 Zagreb,
        <a href="https://azop.hr" target="_blank" rel="noopener noreferrer"> azop.hr</a>.
      </p>

      <p className="text-sm text-slate-500 mt-8">
        Napomena: ova stranica ne sadrži placeholder podatke. Prije naplate usluge potrebno je
        upisati stvarne podatke pružatelja usluge.
      </p>
    </article>
  );
}
