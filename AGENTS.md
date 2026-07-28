# AGENTS.md

## Cursor Cloud specific instructions

VatroLog is a single Next.js 16 (App Router) SaaS app for fire-extinguisher servicing
(Croatian UI). Frontend + backend API routes live in the same Next app (`src/app`),
backed by PostgreSQL via Prisma. There is no separate backend service.

Standard commands are in `package.json` scripts (`dev`, `lint`, `typecheck`, `build`).
The `.githooks/pre-push` hook runs `npm run lint` + `npm run typecheck` (mirrors CI).

### Database (PostgreSQL) — must be started each session
Docker is not available in this VM, so Postgres is installed natively (apt, cluster
`16 main`, port `5432`) instead of via `docker-compose.yml`. It is NOT auto-started, so
start it before running the app or Prisma:

```
sudo pg_ctlcluster 16 main start
```

DB `vatrolog_db`, role `vatrolog` / password `vatrolog`. Connection string lives in
`.env` (`DATABASE_URL=postgresql://vatrolog:vatrolog@127.0.0.1:5432/vatrolog_db?schema=public`).

### `.env` is required (gitignored)
`.env` holds `DATABASE_URL` plus dev secrets. Missing secrets only warn in dev, but
`AUTH_SECRET` / `PLATFORM_AUTH_SECRET` / `OWNER_AUTH_SECRET` must be set (32+ chars, all
distinct) or session-cookie JWT verification fails and login won't work. `ENCRYPTION_KEY`
must differ from `AUTH_SECRET`. The file persists in the VM snapshot; if it's ever
missing, recreate it with those keys, the URLs (`APP_BASE_URL`/`NEXT_PUBLIC_APP_URL` =
`http://localhost:3000`), and `BILLING_MODE=manual`.

### First-time / reset DB setup
```
npx prisma migrate deploy
npx tsx prisma/seed.ts          # load env first, e.g. `set -a; . ./.env; set +a`
```

### Seeding gotcha
`npm run seed` (and `npx prisma db seed`) is BROKEN: `prisma/seed.ts` uses
`import.meta.url`, but `tsconfig.seed.json` compiles as CommonJS via `ts-node`, so it
fails with "import.meta ... CommonJS" + "Duplicate identifier 'require'". Run it with
`tsx` instead (which handles ESM): `npx tsx prisma/seed.ts` (with `.env` exported). Other
`ts-node` seed scripts that don't use `import.meta` are unaffected.

### Seeded dev logins (after seeding)
- Tenant admin: `01-mojatvr` / `admin123` at `/login`
- Workshop: `01-mojatvrS` / `workshop123` at `/login`
- Platform owner: `owner` / `owner123` at `/platform/login`

### Run
`npm run dev` serves at http://localhost:3000. Rate-limit (Upstash) and S3 storage are
unconfigured in dev — they fall back to in-memory / local disk and log warnings; this is
expected. Stripe/Google OAuth/mail are not configured locally (`BILLING_MODE=manual`).
