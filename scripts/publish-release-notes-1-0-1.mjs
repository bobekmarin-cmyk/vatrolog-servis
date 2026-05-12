/**
 * Jednokratna skripta: objavi release-notes obavijest za v1.0.1.
 * Pokreni: node scripts/publish-release-notes-1-0-1.mjs
 *
 * Idempotentno: traži postojeću obavijest s istim title-om i overwritea sadržaj.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VERSION = "1.0.1";
const TITLE = `Ažuriranje VatroLog v${VERSION}`;
const SUMMARY =
  "Nova stranica Obavijesti za admine, vendor modul za pisanje poruka, prepravke primke (PDF) i preimenovanje „preddefinirani dijelovi” u „Dijelovi proizvođača”.";

const BODY = [
  "Pozdrav!",
  "",
  "U ovom ažuriranju donosimo novu stranicu Obavijesti — od sada vendor (vatrolog.com) može tvrtkama korisnicama programa slati poruke, najave održavanja i detaljne release notes za nove verzije programa. Sidebar admina prikazuje crveni broj nepročitanih poruka pa nijedna važna informacija ne ostaje propuštena.",
  "",
  "Uz to, primka radnog naloga je preuredjena (vidljivije inicijalno preuzimanje + jasan trag svih naknadnih dostava po danu), te je terminologija u postavkama dijelova ujednačena na „Dijelovi proizvođača”.",
].join("\n");

const PAYLOAD = {
  version: VERSION,
  releaseDate: "2026-05-12",
  sections: [
    {
      kind: "NEW",
      title: "Novo",
      items: [
        "Nova stranica Obavijesti za admine korisničkih tvrtki — popis poruka koje šalje vendor, s detaljnim prikazom svake poruke i automatskim označavanjem pročitanog kad se otvori.",
        "Crveni broj nepročitanih poruka u sidebaru pored stavke „Obavijesti” — svaki admin mora ući u stranicu da bi se broj smanjio.",
        "Vendor (platform) modul Obavijesti: kreiranje skica, objavljivanje, arhiviranje i brisanje poruka, s pregledom pročitanosti (broj admina koji su pročitali / ukupno aktivnih).",
        "Vendor modul Kategorije obavijesti: dodaj proizvoljne kategorije (boja, slug, sortiranje, oznaka „Ažuriranja”). Default kategorije su „Općenito”, „Obavijest o održavanju” i „Ažuriranja”.",
        "Posebna kategorija „Ažuriranja” s proširenim editorom: verzija, datum objave, te strukturirane sekcije Novo / Poboljšano / Ispravljeno / Važno za korisnike (ovo što sad čitate je upravo takva poruka).",
        "Naslov „POPIS PRIMLJENIH APARATA” iznad tablice u PDF primci, s ujednačenim fontom i veličinom (Roboto 9 pt) cijelog bloka primitka.",
      ],
    },
    {
      kind: "IMPROVED",
      title: "Poboljšano",
      items: [
        "Primka radnog naloga (PDF): inicijalno preuzimanje uvijek prikazuje točno onoliko aparata koliko je upisano kod kreiranja naloga (npr. „09.05.2026. — Na servis je primljeno 5 vatrogasnih aparata.”).",
        "Naknadno dodani placeholderi u primci se grupiraju po kalendarskom danu (Europe/Zagreb) — jedan red po danu s ažurnim zbrojem (dodavanje/brisanje istog dana ažurira broj automatski).",
        "Donji red u primci „Još nije identificirano u tablici: N aparata” prikazan sitnijim slovima i sivijom bojom, bez tehničke riječi „placeholder”.",
        "Veći razmak iznad naslova „POPIS PRIMLJENIH APARATA” i 6 pt razmak do same tablice za bolji vizualni hijerarhijski tok.",
        "Tablice u administraciji /admin/settings/services i /admin/settings/authorizations dobile su isti minimalistički dizajn kao tablica „Dijelovi proizvođača”.",
        "Terminologija u postavkama dijelova ujednačena: „Preddefinirani dijelovi” → „Dijelovi proizvođača” (UI, API poruke, komentari u shemi).",
      ],
    },
    {
      kind: "FIXED",
      title: "Ispravljeno",
      items: [
        "Ispravljen zatvarajući tag u CustomServicesTable koji je u rijetkim slučajevima mogao zalomiti renderiranje.",
        "Pretrage na popisima dijelova proizvođača i vlastitog kataloga sad koriste isti placeholder tekst i izgled inputa.",
      ],
    },
    {
      kind: "IMPORTANT",
      title: "Važno za korisnike",
      items: [
        "Ova obavijest (i sve buduće „Ažuriranja”) automatski će se prikazati svim adminima — molimo otvorite je da bi crveni broj u sidebaru nestao.",
        "Brojač pročitanih poruka je per-admin: ako u istoj tvrtki postoji više admin računa, svaki mora otvoriti poruku zasebno.",
        "Nakon ovog ažuriranja u podnožju PDF dokumenata pisat će v1.0.1 — koristite to za interno praćenje verzije pri prijavi neke greške ili sugestije.",
      ],
    },
  ],
};

async function main() {
  const cat = await prisma.notificationCategory.findUnique({ where: { slug: "azuriranja" } });
  if (!cat) {
    console.error('Kategorija "Ažuriranja" (slug: azuriranja) ne postoji. Pokreni migracije.');
    process.exit(1);
  }

  const existing = await prisma.notification.findFirst({
    where: { categoryId: cat.id, title: TITLE },
  });

  const data = {
    categoryId: cat.id,
    title: TITLE,
    summary: SUMMARY,
    body: BODY,
    pinned: true,
    status: "PUBLISHED",
    publishedAt: existing?.publishedAt ?? new Date(),
    updatePayload: PAYLOAD,
  };

  if (existing) {
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        summary: data.summary,
        body: data.body,
        pinned: data.pinned,
        status: data.status,
        publishedAt: data.publishedAt,
        updatePayload: data.updatePayload,
      },
    });
    console.log(`Updated existing release notes notification: ${existing.id}`);
  } else {
    const created = await prisma.notification.create({ data });
    console.log(`Created release notes notification: ${created.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
