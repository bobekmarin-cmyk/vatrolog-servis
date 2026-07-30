# Auto-fix agent — automatsko rješavanje produkcijskih grešaka

Cilj: kad nešto pukne u produkciji, agent sam analizira grešku, napravi popravak,
provjeri ga (lint + typecheck + build) i otvori pull request — bez da itko mora
intervenirati usred noći.

Workflow: [`.github/workflows/auto-fix.yml`](../.github/workflows/auto-fix.yml)

---

## Što treba postaviti (jednokratno)

### 1. Cursor API ključ

1. Otvori [cursor.com/dashboard](https://cursor.com/dashboard) → **Integrations** → **API Keys** → *Create API Key*
2. U GitHubu: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `CURSOR_API_KEY`
   - Value: kopirani ključ

### 2. Dozvoli Actionsima otvaranje PR-ova

**Settings → Actions → General → Workflow permissions**

- ✅ *Read and write permissions*
- ✅ *Allow GitHub Actions to create and approve pull requests*

Bez ovoga agent može popraviti kod, ali ne može otvoriti PR.

---

## Kako se agent pokreće

| Okidač | Kada | Što agent dobije |
| --- | --- | --- |
| `workflow_run` | CI padne na `main` | Zadnjih 12 kB logova neuspjelog runa |
| `issues` | Issue s labelom `sentry` ili `auto-fix` | Naslov i tijelo issuea (stack trace) |
| `repository_dispatch` | Vanjski poziv (Sentry/Slack) | JSON payload s opisom greške |
| `workflow_dispatch` | Ručno iz Actions taba | Tekst koji sam upišeš |

U svim slučajevima agent **samo mijenja datoteke**. Granu, commit, push i PR
radi workflow deterministički — tako u historyju uvijek postoji trag tko je što
napravio.

---

## Spajanje Sentryja

> Sentryjeva akcija **„Create a new GitHub issue"** dostupna je tek na **Business**
> planu. Zato ne idemo preko GitHub issuea nego preko webhooka — radi na svakom
> planu, uključujući besplatni.

Tok je: Sentry → `POST /api/webhooks/sentry` → GitHub Actions (`auto-fix.yml`) → agent.

### 1. Napravite Internal Integration u Sentryju

Sentry → **Settings → Developer Settings → Custom Integrations** →
**Create New Integration** → **Internal Integration**

- **Name**: `VatroLog auto-fix`
- **Webhook URL**: `https://vatrolog.com/api/webhooks/sentry`
- **Alert Rule Action**: ✅ uključite (bez toga se integracija neće pojaviti u popisu akcija)
- **Permissions**: `Issue & Event: Read` je dovoljno
- **Webhooks**: označite `issue` i `error` ako su ponuđeni

Spremite pa kopirajte **Client Secret** — treba za provjeru potpisa.

### 2. Dodajte varijable u Railway

Railway → servis `vatrolog-servis` → **Variables**:

```
SENTRY_WEBHOOK_SECRET=<Client Secret iz Sentryja>
```

Za pokretanje workflowa koristi se `GITHUB_AUTOMATION_TOKEN`, a ako njega nema,
`GITHUB_BACKUP_TOKEN` (isti token kao za ručni backup — treba mu
**Actions: Read and write**).

### 3. Napravite Alert u Sentryju

Sentry → **Alerts → Create Alert → Issues**

- **Environment**: `production`
- **WHEN**: samo *A new issue is created* (uklonite ostale okidače — inače bi i
  „issue resolved" pokretalo agenta)
- **IF**: ostavite prazno (`Any event`)
- **THEN**: *Send a notification via VatroLog auto-fix*
- **Save Rule**

### Provjera

Na **Platforma → Zdravlje sustava** red **„Sentry → auto-fix agent"** mora
pisati **Povezan**. Kad se pojavi nova greška, u GitHub **Actions** pokreće se
**Auto-fix**, a u logu aplikacije zapis `sentry_webhook_agent_dispatched`.

### Sigurnost

Ruta je javna (Sentry nema našu sesiju), pa je zaštita HMAC potpis:
`sentry-hook-signature` mora odgovarati tijelu zahtjeva potpisanom Client
Secretom. Bez ispravnog potpisa ruta vraća 401. Isti issue se u roku 10 minuta
neće poslati dvaput.

### Ručni put (i dalje radi)

Ako issue otvorite sami, dodajte mu labelu `auto-fix` ili `sentry` i agent se
pokrene. Isto vrijedi za issue koji otvori Sentry na Business planu — workflow
ga prepozna po tekstu `Sentry Issue:` u tijelu.

### Praćenje grešaka u pregledniku

Server i preglednik su dva odvojena izvora. Za oba trebaju DSN varijable u
Railwayu (servis aplikacije → Variables):

```
SENTRY_DSN=https://...            # greške na serveru
NEXT_PUBLIC_SENTRY_DSN=https://... # greške u pregledniku (ista vrijednost)
```

DSN nije tajna — po dizajnu se šalje u preglednik. Bez `NEXT_PUBLIC_SENTRY_DSN`
greške u React komponentama i hidraciji **nigdje se ne bilježe**; vide se samo u
konzoli korisnika. Stanje oba DSN-a piše na **Platforma → Zdravlje sustava**.

### Filtriranje šuma

`src/lib/sentryFilters.ts` odbacuje prijave na koje se ne može djelovati:
greške iz proširenja preglednika, prekinute zahtjeve kod gubitka mreže i
Next.js-ovu internu kontrolu toka (`redirect()` i `notFound()` rade tako da
bacaju iznimku). Ako se u Sentryju pojavi novi tip šuma, dodajte podniz poruke
u `SENTRY_IGNORE_ERRORS`.

### Alternativa: direktan webhook

Ako radije ideš bez GitHub issuea, pošalji `repository_dispatch`:

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <GITHUB_PAT_s_repo_scopeom>" \
  https://api.github.com/repos/bobekmarin-cmyk/vatrolog-servis/dispatches \
  -d '{"event_type":"sentry-error","client_payload":{"title":"PrismaClientKnownRequestError","culprit":"GET /work-orders/[id]","url":"https://sentry.io/..."}}'
```

## Spajanje Slacka

Slack Workflow Builder → korak **Send an HTTP request** na isti `/dispatches`
endpoint, s `"event_type": "slack-error"` i porukom u `client_payload`. Tako
možeš iz Slack kanala prijaviti grešku i agent kreće odmah.

---

## Sigurnosne granice

Agent radi pod ograničenjima iz [`.cursor/cli.json`](../.cursor/cli.json):

- **smije** čitati repo i pisati u `src/`, `prisma/`, `scripts/`, `docs/`
- **ne smije** čitati ni pisati `.env*`, mijenjati workflowe, brisati datoteke

Dodatno, workflow:

- pokreće `lint + typecheck + build` prije nego otvori PR
- ako provjere padnu, PR se otvara kao **draft** s jasnim upozorenjem
- ne mergea ništa osim ako to eksplicitno uključiš (vidi dolje)

### Izbor modela

Bez dodatnih postavki agent koristi zadani model vašeg Cursor računa. Ako želite
konkretan model, dodajte repo varijablu:

**Settings → Secrets and variables → Actions → Variables → New repository variable**

- Name: `AUTOFIX_MODEL`
- Value: npr. `sonnet-4.5` ili `gpt-5`

Model se namjerno ne upisuje fiksno u workflow — slugovi se s vremenom mijenjaju,
pa bi zastarjeli naziv rušio svako pokretanje.

### Auto-merge (isključen po defaultu)

Dok je aplikacija u produkcijskom testiranju, preporuka je da popravke pogledaš
prije mergea. Kad budeš spreman da agent zatvara krug sam:

**Settings → Secrets and variables → Actions → Variables → New repository variable**

- Name: `AUTOFIX_AUTOMERGE`
- Value: `true`

Tada se PR s uspješnim provjerama mergea automatski (squash). Postavi na `false`
ili obriši varijablu da se vratiš na ručni pregled.

---

## Kad agent ne napravi ništa

Ako je uzrok nejasan ili popravak traži poslovnu odluku (npr. „koja je točno
ispravna količina?"), agent namjerno **ne** dira kod i workflow to zapiše u log.
To je bolje nego da nagađa i pokvari podatke.

---

## Ograničenja koja je dobro znati

- Agent vidi samo ono što mu proslijedimo (logovi, stack trace). Za greške koje
  se vide tek u UI-u i dalje treba ljudski opis.
- Ne dira migracije baze automatski osim ako je to očit uzrok — schema promjene
  su rizične i traže pregled.
- Jedan autofix po okidaču (`concurrency` grupa) — neće se pokrenuti deset
  agenata za istu grešku.
