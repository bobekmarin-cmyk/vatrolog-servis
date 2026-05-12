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

      <h2>Pružatelj usluge</h2>
      <p>
        <strong>Via Madera d.o.o.</strong>
        <br />
        Usluga: <strong>VatroLog</strong> — digitalni servis vatrogasnih aparata
      </p>

      <h2>Registarski podaci</h2>
      <ul>
        <li>OIB: <strong>40918539877</strong></li>
        <li>Pravni oblik: društvo s ograničenom odgovornošću (d.o.o.)</li>
      </ul>

      <h2>Kontakt</h2>
      <ul>
        <li>
          E-mail / podrška / DPO:{" "}
          <a href="mailto:info@vatrolog.com">info@vatrolog.com</a>
        </li>
        <li>
          Telefon: <a href="tel:+385976123983">097 612 3983</a> (radnim danom 9:00 – 17:00)
        </li>
      </ul>

      <h2>Nadzorno tijelo</h2>
      <p>
        Agencija za zaštitu osobnih podataka (AZOP), Selska cesta 136, 10000 Zagreb,
        <a href="https://azop.hr" target="_blank" rel="noopener noreferrer"> azop.hr</a>.
      </p>
    </article>
  );
}
