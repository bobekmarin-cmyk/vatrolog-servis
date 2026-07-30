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

## Spajanje Sentryja (preporučeno)

Sentry ima native GitHub integraciju i može sam otvoriti issue:

1. Sentry → **Settings → Integrations → GitHub** → *Install* i odaberi repo
   `bobekmarin-cmyk/vatrolog-servis`
2. Sentry → **Alerts → Create Alert → Issues**
   - Uvjet: *A new issue is created* (po želji dodaj `level:error`)
   - Akcija: **Create a GitHub issue**
3. Da se autofix okine, issue mora imati labelu `sentry`.
   Najlakše: **Settings → Labels** → kreiraj `sentry`, pa u Sentry alert akciji
   postavi tu labelu. Ako Sentry ne postavlja labelu, dodaj je ručno — agent se
   pokrene i na naknadno dodanu labelu (`types: [labeled]`).

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
