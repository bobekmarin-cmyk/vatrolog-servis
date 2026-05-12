/**
 * Jednokratna skripta: objavi release-notes obavijest za v1.0.3.
 * Pokreni: node scripts/publish-release-notes-1-0-3.mjs
 *
 * Idempotentno: traži postojeću obavijest s istim title-om i overwritea sadržaj.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VERSION = "1.0.3";
const TITLE = `Ažuriranje VatroLog v${VERSION}`;
const SUMMARY =
  "Redizajn email predložaka u stilu PDF dokumenata, novi platformski editor za vendor predloške i SMTP integracija za slanje obavijesti s vlastite domene (npr. info@vatroservis.hr).";

const BODY = [
  "Pozdrav!",
  "",
  "U ovom ažuriranju donosimo veliki pomak u radu s e-mailovima.",
  "",
  "Predlošci svih e-mailova (i vendorskih i onih koje vi šaljete kupcima) potpuno su redizajnirani u istom čistom, minimalističkom stilu kao otpremnica i upisnik — ista tipografija, crveni naglasak, jasne sekcije i informativan podnožni potpis.",
  "",
  "Najveća novost: uz Gmail integraciju, sada možete spojiti i vlastiti SMTP server (npr. info@vatroservis.hr) i slati obavijesti kupcima s vlastite domene. Postavke su predefinirane za HT, A1, Microsoft 365, Gmail SMTP i Yahoo, a podržan je i bilo koji vlastiti SMTP server.",
].join("\n");

const PAYLOAD = {
  version: VERSION,
  releaseDate: "2026-05-12",
  sections: [
    {
      kind: "NEW",
      title: "Novo",
      items: [
        "SMTP integracija za slanje obavijesti kupcima s vlastite domene (npr. info@vatroservis.hr) — alternativa postojećoj Gmail integraciji.",
        "Predlošci za poznate hrvatske providere u SMTP formi: Hrvatski Telekom (mail.ht.hr), A1 (mail.a1net.hr / mail.vip.hr), Microsoft 365, Gmail SMTP (app password), Yahoo Mail i opcija „Vlastiti SMTP server”.",
        "Stranica Postavke → Postavke maila redizajnirana: dvije kartice (Gmail i SMTP) jedna pored druge, oznaka „Aktivno” na onome koji se trenutno koristi.",
        "Mogućnost odabira aktivnog providera kad su konfigurirana oba: jednim klikom prebacujete je li mail kupcima ide preko Gmaila ili preko vašeg SMTP servera, a drugi ostaje sačuvan.",
        "Gumb „Pošalji test” unutar SMTP postavki — odmah pošalje testnu poruku da provjerite radi li integracija prije slanja stvarnim kupcima.",
        "Pri spremanju SMTP postavki sustav automatski provjerava spajanje na server i odbija krive postavke odmah, da nikad ne ostanete s neispravnom konfiguracijom.",
        "Vendor (platform) modul „Email predlošci” — vendor sad može uređivati 8 tipova sistemskih e-mailova (obnova lozinke, verifikacija, pozivnica, podsjetnik o pretplati itd.) bez izmjene koda, s live preview i opcijom slanja test poruke.",
      ],
    },
    {
      kind: "IMPROVED",
      title: "Poboljšano",
      items: [
        "Svi e-mailovi koje sustav šalje vašim kupcima (obavijesti o isteku servisa, upisnik s PDF prilogom, otpremnica, …) sad koriste isti minimalistički dizajn kao PDF dokumenti — ista tipografija, crveni naglasak, jasne sekcije, čitljivo na svim e-mail klijentima.",
        "Vendor → korisnik e-mailovi (reset lozinke, verifikacija, pozivnice, obavijesti o pretplati) također su prebačeni na novi dizajn s istim brandingom.",
        "Lozinka SMTP servera pohranjuje se šifrirano (AES-256-GCM) i nikad se ne vraća na klijent, čak ni adminu koji ju je unio.",
        "Postavke maila imaju nove statusne poruke: „Mail nije konfiguriran” umjesto starog „Gmail nije povezan” gdje god se prikazuje upozorenje (Plan servisa, slanje upisnika, …).",
        "Optimizirano dohvaćanje statusa maila — jedan upit umjesto više, brže učitavanje stranica koje provjeravaju je li mail konfiguriran (servisni nalog, plan servisa).",
      ],
    },
    {
      kind: "FIXED",
      title: "Ispravljeno",
      items: [
        "Ispravljen prikaz zadnje pošiljke u prozoru za pisanje obavijesti — sad ispravno prikazuje adresu s koje se mail šalje (Gmail account ili SMTP From) bez obzira na trenutnog providera.",
        "Pošiljatelj e-maila (From) sad pravilno koristi „Naziv tvrtke <e-mail>” format pri SMTP slanju, umjesto golog e-maila.",
      ],
    },
    {
      kind: "IMPORTANT",
      title: "Važno za korisnike",
      items: [
        "Ako koristite vlastiti hosting / domenu i imate poslovni e-mail tipa info@vatroservis.hr, sad ga možete spojiti u Postavke → Postavke maila → kartica „SMTP”. Vaši kupci će obavijesti dobivati izravno s te adrese, bez „preko Gmaila”.",
        "Postojeća Gmail integracija ostaje u potpunosti funkcionalna i nije potrebno mijenjati ništa ako vam Gmail odgovara.",
        "Pri prvom spremanju SMTP postavki sustav će se pokušati spojiti na server (do 10s) — ako vidite grešku, provjerite host, port (465 SSL ili 587 STARTTLS), korisničko ime i lozinku. Za 2FA račune (Microsoft 365, Gmail, Yahoo) generirajte „App password” umjesto regularne lozinke.",
        "Za HT korisnike: predložak postavlja `mail.ht.hr` na portu 465 (SSL/TLS). Ako 465 ne radi kod vašeg paketa, isključite SSL/TLS i probajte port 587.",
        "Nakon ovog ažuriranja u podnožju PDF dokumenata pisat će v1.0.3 — koristite to za interno praćenje verzije pri prijavi neke greške ili sugestije.",
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
