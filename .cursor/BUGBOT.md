# Bugbot upute za pregled (VatroLog)

Pregledavaj PR-ove na hrvatskom. Fokus na sigurnost, multi-tenant izolaciju i CI paritet.
Označi nalaze koji krše invarijante ispod kao **blocking**.

## Multi-tenant izolacija (servisi/tvrtke)

- Svaki upit nad podacima servisa (work orders, extinguishers, customers, delivery notes,
  registers, primke, warehouse) **mora** filtrirati po `companyId` aktivne sesije.
  Prijavi svaki Prisma upit koji čita/piše tenant podatke bez `companyId` (ili dokazive
  ekvivalentne veze) kao mogući cross-tenant leak.
- Ne smije se vraćati ni nagovještavati postojanje podataka drugog servisa. Posebno na
  korisničkom (owner) portalu i kod dijeljenja podataka među servisima.

## Korisnički portal (owner) i dijeljenje među servisima

- **Serviser 1 NIKAD ne smije vidjeti podatke ni identitet Servisera 2** (aparate, naloge,
  otpremnice, primke, upisnike, nazive računa). Prijavi svako izlaganje `invitedByCompanyName`
  ili sličnog koje bi otkrilo drugi servis.
- Pristup owner podacima ide preko **aktivnog `ownerOrgId`** (OwnerOrg po OIB-u) i
  `OwnerOrgMembership` (uloga `ADMIN`/`MEMBER`). Funkcije za dohvat owner podataka primaju
  `ownerOrgId` eksplicitno — prijavi ako se umjesto toga koristi `ownerId` ili se org rješava
  iz cookieja u kontekstu bez sesije (npr. cron).
- Upravljanje računima tvrtke smije raditi **samo `ADMIN`** te tvrtke; vendor (platforma)
  ima override. Serviser poziva samo jednog admina i ne upravlja popisom računa.
- Serviserov "Povuci" smije ugasiti samo **vlastitu** vezu (`OwnerCustomerLink`), nikad
  zajednički korisnički račun.

## Auth / tokeni

- Lozinke samo preko `bcryptjs`; sesije preko `jose` (`vb_session`, `vb_owner_session`).
- Invite/reset tokeni: provjeri `usedAt`, `expiresAt`, ispravan `type`. Prijavi tokene bez
  isteka ili bez označavanja iskorištenosti.
- Provjeri rate-limit na auth/invite rutama.

## CI paritet (česti uzroci crvenog CI-a)

- **JSX tekst ne smije sadržavati ravne navodnike `"` ni `'`** — ESLint
  `react/no-unescaped-entities` ruši CI. Koristi hrvatske navodnike „ … " ili `&quot;`.
- Sve mora proći `npm run lint` i `npm run typecheck` (isto što radi CI i `.githooks/pre-push`).
- Bez `any` (eksplicitni `@typescript-eslint/no-explicit-any`), bez nekorištenih varijabli.

## Migracije

- Promjene sheme prate manualnom migracijom u `prisma/migrations/` (s backfillom gdje treba).
  Produkcija pokreće `prisma migrate deploy` na startu — prijavi schema promjene bez migracije.
