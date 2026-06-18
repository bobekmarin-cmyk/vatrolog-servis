## Što i zašto

<!-- Kratak opis promjene i razlog (fokus na "zašto"). -->

## Provjere prije mergea

- [ ] `npm run verify` (lint + typecheck) prolazi lokalno
- [ ] Multi-tenant: novi upiti filtriraju po `companyId` / `ownerOrgId`
- [ ] Owner portal: nema curenja podataka ni identiteta drugog servisa
- [ ] Schema promjene popraćene migracijom (+ backfill ako treba)
- [ ] CI `check` zelen i Bugbot pregled riješen

## Bilješke za review

<!-- Rubni slučajevi, sigurnosne implikacije, ručni smoke koraci. -->
