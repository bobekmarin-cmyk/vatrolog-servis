import { PrismaClient } from "@prisma/client";

/**
 * Jedan Prisma klijent po procesu — i u produkciji.
 *
 * Next.js server kod završi u više bundle chunkova, pa se modul zna evaluirati
 * više puta unutar istog procesa. Bez `globalThis` pina svaki chunk otvori
 * vlastiti connection pool i broj konekcija prema Postgresu se umnoži dok
 * baza ne počne odbijati nove (`P1001 Can't reach database server`).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Prisma bez `connection_limit` uzima `num_cpus * 2 + 1`. U kontejneru
 * `num_cpus` je broj jezgri *hosta* (često 8–32), pa jedna instanca zauzme
 * 17–65 konekcija i iscrpi Railway Postgres. Zato limit postavljamo eksplicitno.
 */
function buildDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;

  const limit = process.env.DATABASE_CONNECTION_LIMIT?.trim() || "10";
  const poolTimeout = process.env.DATABASE_POOL_TIMEOUT?.trim() || "20";
  const connectTimeout = process.env.DATABASE_CONNECT_TIMEOUT?.trim() || "10";

  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", limit);
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", poolTimeout);
    }
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", connectTimeout);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

/**
 * Greške kod kojih upit sigurno NIJE izvršen na bazi, pa je ponavljanje sigurno
 * i za write operacije:
 *  - P1001 — baza nedostupna (konekcija nije ni uspostavljena)
 *  - P1017 — server je zatvorio konekciju
 *
 * P2024 (istekao timeout čekanja na konekciju) namjerno NIJE ovdje: taj se kod
 * javlja kad je pool već pun, pa bi ponavljanje samo pojačalo zagušenje.
 */
const RETRYABLE_CODES = new Set(["P1001", "P1017"]);

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && RETRYABLE_CODES.has(code)) return true;
  return (err as { name?: unknown }).name === "PrismaClientInitializationError";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPrismaClient(): PrismaClient {
  const url = buildDatabaseUrl();

  const base = new PrismaClient({
    log: ["error", "warn"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });

  /**
   * Dijagnostika: `PRISMA_LOG_QUERIES=1` ispisuje svaki upit s trajanjem.
   * Broj upita po stranici je kljucan kad je latencija prema bazi visoka —
   * tada svaki dodatni krug izravno produljuje odgovor servera.
   */
  const logQueries = process.env.PRISMA_LOG_QUERIES === "1";

  // Kratkotrajni mrežni prekidi prema Railway private networku ne smiju rušiti
  // request — tri pokušaja s backoffom pokrivaju restart baze i DNS blip.
  const extended = base.$extends({
    query: {
      async $allOperations({ args, query, model, operation }) {
        const maxAttempts = 3;
        let lastError: unknown;
        const startedAt = logQueries ? Date.now() : 0;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            const result = await query(args);
            if (logQueries) {
              console.log(
                `[prisma] ${model ?? "raw"}.${operation} ${Date.now() - startedAt}ms`,
              );
            }
            return result;
          } catch (err) {
            lastError = err;
            if (attempt === maxAttempts || !isRetryable(err)) throw err;
            await sleep(attempt * 150);
          }
        }
        throw lastError;
      },
    },
  });

  // `$extends` vraća prošireni tip; ostatak koda tipizira `PrismaClient`.
  return extended as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
