# Produkcijski launch — što je u repozitoriju vs što radi vlasnik ručno

Ovaj dokument nadopunjuje [`launch-ops-checklist.md`](./launch-ops-checklist.md) i [`google-oauth-verification.md`](./google-oauth-verification.md). Namijenjen je brzom pregledu: što je već pokriveno kodom/CI-jem, a što i dalje traži pristup tvom Google Cloud računu, DNS-u i hosting provideru.

---

## Automatizirano / u repozitoriju

- **Favicon i OAuth logo:** izvor je `public/branding/favicon-source.png`. Generirane datoteke (`src/app/icon.png`, `src/app/apple-icon.png`, `public/icon-512.png`) nastaju naredbom `npm run icons:build` (koristi `sharp`). Nakon promjene izvornog PNG-a pokreni build i commitaj izlaz.
- **Ručni model naplate:** env `BILLING_MODE=manual` (ili izostavljen `STRIPE_SECRET_KEY`) — platform Health ne prikazuje Stripe kao grešku; Checkout i Customer Portal API vraćaju 501 dok je ručni model aktivan. Vidi `.env.example`.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — `npm ci`, `npm run lint`, `npm run typecheck`, `npx prisma validate` na `main` i pull requestovima.

---

## Samo ti (ručno)

- **Google Cloud:** OAuth consent screen (tekstovi i logo prema `docs/google-oauth-verification.md`), verifikacija domene u Search Consoleu, submit za verifikaciju aplikacije, demo video.
- **Hosting (npr. Railway / Vercel):** sve tajne iz `.env.example` koje produkcija treba (`AUTH_SECRET`, `DATABASE_URL`, `APP_BASE_URL`, Gmail/SMTP, S3, Upstash, Sentry, itd.).
- **DNS:** SPF, DKIM, DMARC za slanje maila s tvoje domene.
- **Operativa:** backup baze i S3 politika, smoke testovi iz `launch-ops-checklist.md`, SLA i kontakt za hitne slučajeve.

Za detaljan operativni popis koraci-po-korak i test matricu, drži se **`docs/launch-ops-checklist.md`**.
