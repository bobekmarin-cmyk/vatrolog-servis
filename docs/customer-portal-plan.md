# Korisnički portal — detaljan plan

Portal za **vlasnike vatrogasnih aparata** (uloga `Owner`, prikaz "Vlasnik").
Bazni put: **`/korisnik`** (zaseban od legacy javnog linka `/portal/[secret]`).

## Usaglašene odluke

| Tema | Odluka |
|---|---|
| Naziv | "Korisnički portal", uloga `Owner` ("Vlasnik") |
| Prijava | E-mail + lozinka (4. auth sloj, cookie `vb_owner_session`) |
| Više servisera | Globalni račun, agregacija po e-mailu vlasnika; OIB = detekcija; svaki serviser **odobrava** dijeljenje |
| Pozivnica | Vendor mail (VatroLog), tekst navodi servisera koji poziva |
| Iniciranje | Serviser poziva + sustav detektira postojeći OIB → ponudi "zahtjev za dijeljenje" |
| Računi po vlasniku | Jedan (v1) |
| Dokumenti | Nalozi + aparati + otpremnice + upisnici + statistika (sve) |
| Redovni pregled | Zaseban ciklus (3 mj.), **privatan za vlasnika** (serviser ne vidi), vođen portalskom stranom |
| Podsjetnici | Obavijest u portalu + automatski mjesečni e-mail |
| QR | Skeniranje unutar portala (kamera u webu), bez mijenjanja naljepnica |

## Auth model

- Reuse `AUTH_SECRET` (Edge-safe) uz opcionalni `OWNER_AUTH_SECRET` fallback. Cookie `vb_owner_session`, payload `{ ownerId, kind: "owner" }`, 30 dana.
- `lib/ownerAuth.ts`: `signOwnerSession`, `verifyOwnerSession`, `getOwnerSession`, `requireOwnerSession`.
- Reuse `AuthToken` (dodaje se `ownerId` + tipovi `OWNER_INVITE`, `OWNER_PASSWORD_RESET`, `OWNER_EMAIL_VERIFY`).
- Reuse bcrypt (cost 12), `generateToken`/`hashToken`, `rateLimit`, `sendSystemMail`.
- Middleware: nova grana za `/korisnik` + `/api/portal/`. Javni: `/korisnik/login`, `/korisnik/register`, `/korisnik/forgot-password`, `/korisnik/reset-password`, `/korisnik/verify-email`, `/korisnik/invite/[token]`, `/api/portal/auth/*`.

## Podatkovni model (Prisma)

```prisma
model Owner {
  id, email @unique, passwordHash?, name?, phone?,
  emailVerifiedAt?, lastLoginAt?, sessionsValidAfter?, createdAt, updatedAt
  links OwnerCustomerLink[]
  authTokens AuthToken[]
  regularInspections RegularInspection[]
}

enum OwnerLinkStatus { PENDING_INVITE  ACTIVE  DECLINED  REVOKED }

model OwnerCustomerLink {
  id, ownerId?, companyId, customerId @unique, status,
  invitedEmail, invitedByAccountUserId?, invitedAt, acceptedAt?, revokedAt?,
  // Faza 2: shareRequest polja (drugi serviser traži dijeljenje)
}
```

`AuthToken` dobiva `ownerId String?` + relaciju. Customer/Company/AccountUser dobivaju natrag-relacije.

## Faze

### Faza 1 — Temelj (ovaj PR)
1. Schema + migracija (`Owner`, `OwnerCustomerLink`, `AuthToken.ownerId`, novi enum tipovi).
2. `lib/ownerAuth.ts` + middleware grana.
3. Pozivnica: serviser UI na detalju kupca (zamjena/uz `CustomerPortalLinkCard`), API `POST /api/customers/[id]/portal-invite`, vendor email template `OWNER_INVITE`.
4. Registracija preko pozivnice: `/korisnik/invite/[token]` → postavi lozinku → Owner kreiran → link ACTIVE.
5. Login/logout/forgot/reset/verify rute + stranice pod `/korisnik`.
6. Portal app (`/korisnik/(app)`): dashboard (statistika), aparati (tablica, filter po odjeljenju/serviseru), nalozi, dokumenti (otpremnice/upisnici PDF).
7. Oznaka u tablici kupaca (—/Pozvan/Aktivan) + status na detalju kupca.

### Faza 2 — Više servisera ✅ GOTOVO
- `lib/ownerSharing.ts` — `findExistingPortalOwnerByOib(oib, excludeCompanyId)` (privatnost: ne otkriva koji drugi serviser).
- `portal-invite` API: nova akcija `share` → veže kupca na postojeći Owner (po OIB-u) kao ACTIVE; serviser time daje privolu za prikaz svojih aparata; vlasnik dobije mail (`OWNER_PORTAL_NEW_SERVICER`).
- Detalj kupca: banner "kupac već koristi portal" + gumb "Poveži moje aparate".
- Lista kupaca: badge **Dostupno** kad isti OIB ima aktivan portal drugdje.
- Agregirani prikaz s filterom po serviseru/odjeljenju već radi iz Faze 1.

### Faza 3 — Redovni pregled ✅ GOTOVO
- `RegularInspection` model (privatno za vlasnika; `companyId`/`extinguisherId`/`ownerId` + checklist polja iz zakonskog teksta, `result OK|ISSUES`).
- `lib/ownerInspections.ts` — provjera pristupa (`ownerCanAccessExtinguisher`), razrješavanje oznake (`resolveOwnerExtinguishersByCode`), izračun roka (zadnji pregled + 3 mj.) i povijest.
- API: `POST /api/portal/inspections` (unos pregleda), `GET /api/portal/extinguishers/resolve?code=` (QR/ručno → aparat(i)).
- Portal stranice: `/korisnik/pregledi` (rokovi + povijest + info), `/korisnik/pregledi/skeniraj` (kamera `BarcodeDetector` + ručni unos), `/korisnik/pregledi/novi` (forma s kontrolnom listom).
- Akcija „Redovni pregled" u tablici aparata + kartica „Treba redovni pregled" na dashboardu.
- Rok se računa runtime iz zadnjeg pregleda; nema zasebnog `nextRegularDue` polja (i ne dira servisne rokove).

### Faza 4 — Podsjetnici ✅ GOTOVO
- Portal badge: broj dospjelih redovnih pregleda uz „Redovni pregledi" u navigaciji (računa se u layoutu) + kartica/banner na dashboardu.
- Mjesečni cron `/api/cron/owner-inspection-reminders` (Vercel: `0 8 1 * *`) — šalje podsjetnik svakom vlasniku s ≥1 dospjelim pregledom; gate na 1. u mjesecu (Zagreb), `?force=1` za ručno testiranje.
- E-mail predložak `OWNER_INSPECTION_REMINDER` (vendor-branded, uređiv u platformi) + `ownerInspectionReminderEmail` helper; log u `EmailLog` (kind `OWNER_INSPECTION_REMINDER`).

## Sigurnost / rizici
- Izolacija auth slojeva (provjera `kind` + DB lookup).
- Rate-limit na login/forgot/invite-accept.
- E-mail verifikacija prije logina.
- GDPR: vlasnik vidi servisne podatke → approval model + uvjeti korištenja.
- Sudar `internalCode` kod više servisera → kod skeniranja vlasnik bira tvrtku.
- Legacy `/portal/[secret]` ostaje read-only dok se ne ugasi.
