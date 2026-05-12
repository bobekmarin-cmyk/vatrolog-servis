# Launch ops checklist

Prije nego pošaljemo prve prave kupce na javnu adresu, ova checklista mora
biti obrađena. Sve točke označavaj jednom (datum + osoba) i čuvaj checklistu
u repu kao audit trag launch-a.

## 1. Tajne (env varijable)

- [ ] `AUTH_SECRET` postavljen, dug (≥ 32 znaka), generiran novim random-om.
- [ ] `PLATFORM_AUTH_SECRET` postavljen, dug, **različit** od `AUTH_SECRET`.
- [ ] `ENCRYPTION_KEY` postavljen, dug, **različit** od `AUTH_SECRET` i `PLATFORM_AUTH_SECRET`.
- [ ] `CRON_SECRET` postavljen i poznat samo Vercel cron konfiguraciji.
- [ ] `DATABASE_URL` pokazuje na produkcijski Postgres (s SSL-om i ograničenim pristupom po IP-u, ako platforma to dopušta).
- [ ] `APP_BASE_URL` eksplicitno postavljen na produkcijsku domenu (`https://app.vatrolog.hr` i sl.).

Provjera u app-u: `src/lib/envChecks.ts` će tijekom boota baciti grešku ako
nešto kritično fali u produkciji. Pokrenuti `npm run build && npm run start`
lokalno s prod env-om kao smoke test.

## 2. Mail infrastruktura

- [ ] Vendor Gmail spojen kroz `/platform/integrations/gmail` (refresh token spremljen, scope `gmail.send` + `gmail.readonly`).
- [ ] SMTP fallback konfiguriran (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`) za slučaj da Gmail token padne.
- [ ] Slanje testnog maila: password reset, account invite, registration request received, registration request rejected.
- [ ] DNS SPF / DKIM / DMARC za `vatrolog.hr` i mail kanale postavljeni i validirani (mxtoolbox, mail-tester).

## 3. Storage

- [ ] S3-kompatibilni bucket konfiguriran (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`).
- [ ] Bucket policies: privatne datoteke, pristup samo preko presigned URL-ova.
- [ ] Generiran i spremljen test PDF kroz tenant flow → provjera da se appearance-a samo u svom company prefixu (`pdf/{companyId}/...`).
- [ ] Backup politika za bucket dogovorena s providerom (R2/B2 imaju lifecycle, AWS S3 versioning).

## 4. Rate-limit i sigurnost

- [ ] Upstash Redis postavljen (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) — bez njega rate-limit pada na in-memory i ne dijeli se preko instanci.
- [ ] Smoke test: 4 brza zahtjeva na `/api/auth/register` s istog IP-a vraćaju 429.
- [ ] CSRF middleware aktivan (Origin/Referer matching) — testirati POST iz cross-origin browser scenarija.
- [ ] Sentry DSN postavljen (`SENTRY_DSN`) i alertovi za nove greške (≥ 5/min) konfigurirani.

## 5. Baza i migracije

- [ ] `prisma migrate deploy` pokrenut na produkciji nakon merga.
- [ ] Backup baze automatiziran (pg_dump dnevno, retencija ≥ 14 dana).
- [ ] Read-only replica (po želji) za platform analitiku.
- [ ] Testni vraćanje (restore) iz backupa bar jednom prije launch-a.

## 6. Onboarding pipeline (registration flow)

- [ ] Test: ispuni `/register` formu → stigne mail "Zahtjev je zaprimljen" i platform alert na `VENDOR_FROM_EMAIL`.
- [ ] Test: u `/platform/registration-requests` otvori zahtjev → odobri → kreirana je tvrtka i poslana onboarding pozivnica.
- [ ] Test: prihvati pozivnicu (postavi admin + workshop lozinke) → admin se može prijaviti.
- [ ] Test: odbij zahtjev → stigne mail s razlogom, audit log zabilježen.
- [ ] Test: pokušaj odobriti zahtjev s OIB-om koji već postoji u Company → API vraća 409.

## 7. Pretplata i blokiranje

- [ ] Test: postavi `activeUntil` u prošlost preko platform-a → svi tenant korisnici dobiju force-logout (sessionsValidAfter bumpan), a sljedeći login vodi na `/subscription-expired`.
- [ ] Test: `blocked = true` → middleware vraća redirect/403 i tenant ne može pristupiti.
- [ ] Cron `subscription-reminders` šalje testni mail "ističe za N dana" (provjeri `EmailLog`).

## 8. SEO i public flow

- [ ] `/` prikazuje landing (s "Otvori aplikaciju" za prijavljene, "Prijava" za anonimne); stari `/landing` URL vraća 308 na `/`.
- [ ] `/sitemap.xml` i `/robots.txt` vraćaju ispravan sadržaj.
- [ ] Open Graph slika se generira na `/opengraph-image` (1200x630) i prikazuje u Slack/Twitter/LinkedIn unfurl-u.
- [ ] Pravne stranice (`/legal/terms`, `/legal/privacy`, `/legal/dpa`, `/legal/impressum`) redovne i pristupačne s landing footera.
- [ ] Cookie banner se pojavljuje, kategorije ne uvjetuju prikaz osnovnog sadržaja.

## 9. Smoke test prvog tenant flow-a

Kreiraj demo tenant kroz odobreni request i proveri:

- [ ] Login → setup-required ako nedostaju IBAN/email/phone.
- [ ] Dovrši company settings → preusmjeren na `/dashboard`.
- [ ] Dodaj prvog kupca preko UI-ja.
- [ ] Otvori prvi radni nalog s 1 aparatom; servisiraj; lock-aj nalog.
- [ ] Provjeri PDF generaciju (delivery note) i da se nalazi u S3.
- [ ] Pošalji mail s portala (test email log).

## 10. Operativne procedure

- [ ] Definiran SLA za odgovor na registracijske zahtjeve (npr. 1 radni dan).
- [ ] Definiran on-call kontakt (telefon + e-mail) za hitne greške.
- [ ] Postavljen status-page (BetterStack / Statuspage / vlastita stranica) s healthcheck-om `/api/health`.
- [ ] Dokumentirana procedura: kako rotirati `AUTH_SECRET`, kako rotirati `ENCRYPTION_KEY` (re-enkripcija Gmail tokena), kako resetirati admin lozinku ručno.

## 11. Pravno i compliance

- [ ] Uvjeti korištenja, Politika privatnosti i DPA usuglašeni s tipičnim ugovornim partnerima.
- [ ] Kontakt podataka u Impressumu odgovara Trgovačkom registru (puni naziv, OIB, adresa, e-mail, telefon).
- [ ] Definiran kanal za zahtjeve subjekata (GDPR access/deletion) i SLA odgovora.

---

Po završetku svih točaka: označi datum, osobu i tag ovaj commit-em na `vX.Y-launch-ready`.
