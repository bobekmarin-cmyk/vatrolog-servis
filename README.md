This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Mail infrastruktura

VatroLog koristi dva odvojena Gmail kanala kroz jedan OAuth client:

| Kanal | Tko | Što šalje | Storage |
|-------|-----|-----------|---------|
| Vendor (platform) | `marin@vatrolog.com` | Sistemski mailovi: reset lozinke, pozivnice, verifikacije, podsjetnici pretplate, monthly report podsjetnici | `PlatformIntegration` |
| Tenant (per-tvrtka) | Gmail svake tvrtke | Obavijesti kupcima (servisni naloga, primka, register) | `Company.gmail*` polja |

Ako vendor Gmail nije spojen, sistemski mail koristi SMTP fallback. Sva slanja loggiraju se u `EmailLog` (s poljem `transport`).

### Google Cloud Console setup (vendor radi jednom)

1. console.cloud.google.com → Create Project: **VatroLog Mail**.
2. APIs & Services → Library → enable **Gmail API**.
3. APIs & Services → OAuth consent screen:
   - User type: **External**.
   - App name: VatroLog. Support email: `marin@vatrolog.com`.
   - Authorized domains: `vatrolog.com` (+ produkcijski domain).
   - **Scopes**: `https://www.googleapis.com/auth/gmail.send` i `https://www.googleapis.com/auth/userinfo.email`.
   - **Test users**: `marin@vatrolog.com` + 2-3 testna tenant Gmail računa (dok je app u Testing).
4. APIs & Services → Credentials → Create credentials → OAuth client ID:
   - Type: **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` + prod URL.
   - Authorized redirect URIs (oba):
     - `http://localhost:3000/api/gmail/callback`
     - `http://localhost:3000/api/platform/gmail/callback`
     - + iste rute na produkcijskom domenu.
5. Spremi `Client ID` i `Client secret` u `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
VENDOR_FROM_EMAIL=marin@vatrolog.com
VENDOR_FROM_NAME=VatroLog
```

6. Domain verification za `vatrolog.com` u Google Search Console (potrebno za prijelaz iz Testing u Production).
7. `marin@vatrolog.com`:
   - Ako je Google Workspace mailbox → radi direktno.
   - Ako je alias forwardiran na Gmail → koristi "Send mail as" u osnovnom Gmail accountu i OAuth ide na taj osnovni račun, a `From` se postavlja na alias.

### Spajanje vendor mail računa u aplikaciji

1. Login na platformu (`/platform/login`) kao OWNER.
2. Otvori `/platform/settings` → tab "Email integracija".
3. Klik na "Poveži Gmail" → Google consent → vraća te u aplikaciju.
4. Pošalji testni mail iz iste stranice da provjeriš da kanal radi.

### SMTP fallback (opcionalno)

Postavi `SMTP_HOST/USER/PASS` ako želiš sigurnosnu mrežu kad vendor Gmail nije dostupan. Koristi App Password (2FA). Ako ni vendor Gmail ni SMTP nisu konfigurirani, dev mode log-a poruku u terminal i vraća success.

### Manualni test plan

1. Spoji vendor Gmail (marin@vatrolog.com) iz Postavki, klikni "Pošalji testni mail".
2. `Forgot password` flow s tenant userom → mail dolazi iz `marin@vatrolog.com`, link radi do isteka.
3. Invite za novi AccountUser → mail stigne i radi 1x.
4. Subscription expiry cron → mail iz vendor Gmail-a (ili SMTP ako vendor nije spojen).
5. Disconnect vendor Gmail → flow se vraća na SMTP/dev fallback.
6. Tenant Gmail (per-company) i dalje šalje kupcima nepromijenjeno.

## Produkcijski launch checklist

Prije javnog lansiranja obavezno prođi `docs/launch-ops-checklist.md`.

Najvažnije:

- Rotirati sve lokalne `.env` secrete koji su ikad korišteni u razvoju.
- Postaviti odvojene `AUTH_SECRET`, `PLATFORM_AUTH_SECRET` i `ENCRYPTION_KEY`.
- Postaviti `APP_BASE_URL`, `CRON_SECRET`, Sentry i backup politiku.
- Napraviti smoke test registracije, email potvrde, login-a, prvog naloga, lock/unlock skladišta i javnih SEO ruta.
