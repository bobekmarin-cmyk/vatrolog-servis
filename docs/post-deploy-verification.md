# Provjera deploya, GSC i Sentry

Kratki vodič nakon svakog većeg deploya na `https://vatrolog.com`.
Automatski dio: `npm run smoke:prod`.

---

## 1. Automatska provjera produkcije

```bash
npm run smoke:prod
# ili druga domena:
node scripts/smoke-prod-deploy.mjs https://vatrolog.com
```

Provjerava:

| URL | Očekivano |
|-----|-----------|
| `/api/health` | `200`, JSON `{ "ok": true, "db": { "ok": true } }` |
| `/sitemap.xml` | `200`, XML `<urlset>` (ne HTML!) |
| `/robots.txt` | `200`, sadrži `Sitemap: https://vatrolog.com/sitemap.xml` |

Numeracija otpremnica (bez baze):

```bash
npm run smoke:delivery-note
```

---

## 2. Google Search Console

### Sitemap

1. Otvori [Google Search Console](https://search.google.com/search-console) → property **vatrolog.com**.
2. **Indexing → Sitemaps**.
3. URL: `https://vatrolog.com/sitemap.xml` → **Submit**.
4. Status mora biti **Success** (ne „Sitemap is HTML“).

Ako piše **„Sitemap is HTML“**: middleware je ranije redirectao na `/login`. Fix je u `src/middleware.ts` (matcher isključuje `sitemap.xml` i `robots.txt`). Provjeri da je deploy prošao i ponovno submitaj.

### Indeksiranje (auth / tenant stranice)

Namjerno **noindex** (ne treba „popravljati“):

- `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/subscription-expired`
- cijeli tenant prostor (`/dashboard`, `/work-orders`, …) — u `robots.txt` **Disallow**

U GSC → **Pages → Not indexed** razlozi tipa *Excluded by 'noindex' tag* ili *Page with redirect* za te URL-ove su **očekivani**. Nakon deploya SEO fixa: **Validate fix** na izvještaju.

### Javne stranice u sitemapi (7 URL-ova)

- `/`
- `/register`
- `/legal/terms`, `/legal/privacy`, `/legal/dpa`, `/legal/impressum`, `/legal/google-api`

---

## 3. Sentry uptime monitor

**Ne koristiti** `https://vatrolog.com/` — landing je SSR + session check i može preći 10 s (cold start).

| Postavka | Vrijednost |
|----------|------------|
| URL | `https://vatrolog.com/api/health` |
| Metoda | GET |
| Očekivani status | 200 |
| Timeout | 15–30 s |
| Interval | 1–5 min |

Tijelo odgovora treba sadržavati `"ok":true` i `"db":{"ok":true}`.

Za **error alerting** (ne uptime): `SENTRY_DSN` u env-u; alert na ≥ 5 novih grešaka / min (Sentry → Alerts).

---

## 4. Smoke test — otpremnica (ručno u aplikaciji)

Nakon deploya s migracijom `20260515140000_delivery_notes`:

1. **Zaključi** postojeći ili novi radni nalog.
2. Klikni **Izdaj otpremnicu** — mora dobiti broj tipa `10-260001` (prefiks iz postavki tvrtke / šifre servisa).
3. **Otpremnica → PDF** — isti sadržaj pri ponovnom otvaranju (arhivski PDF, ne regeneracija).
4. **Pošalji mailom** — isti prilog kao PDF.
5. Status naloga: **Otpremljeno** (zelena oznaka).
6. **Admin → Servis → Otpremnice** — red u evidenciji.
7. (Opcionalno, admin) **Nova otpremnica** — novi broj, banner „Izdane su više otpremnice…“.

Postojeći LOCKED nalozi **bez** klika „Izdaj otpremnicu“ ostaju **Servis završen** — to je namjerno.

### Prefiks broja

**Admin → Postavke tvrtke** → polje **Prefiks broja otpremnice** (2 znaka, npr. `10`). Prazno = automatski iz `serviceCode`.

---

## 5. Migracija baze

Railway `start` već radi `prisma migrate deploy`. Ručna provjera:

```bash
# s produkcijskim DATABASE_URL
npx prisma migrate deploy
```

Tablice: `DeliveryNote`, `DeliveryNoteYearCounter`, stupac `Company.deliveryNoteNumberPrefix`.

---

## Povijest provjera

| Datum | Deploy / commit | smoke:prod | Napomena |
|-------|-----------------|------------|----------|
| 2026-05-21 | `848d9ed` (sitemap middleware) | OK | health 1.1.0, sitemap XML 7 URL-ova, robots OK |
