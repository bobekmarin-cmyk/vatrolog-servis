/**
 * Next.js instrumentation hook — pokreće se jednom po runtime procesu.
 * Inicijalizira Sentry ako je SENTRY_DSN postavljen u env-u.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

/** Prvi upit nakon boota ne smije pasti zato što privatna mreža još nije spremna. */
async function warmUpDatabase() {
  if (!process.env.DATABASE_URL?.trim()) return;
  try {
    const { prisma } = await import("@/lib/prisma");
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return;
      } catch (err) {
        if (attempt === 5) throw err;
        await new Promise((r) => setTimeout(r, attempt * 400));
      }
    }
  } catch (err) {
    console.warn(JSON.stringify({ lvl: "warn", evt: "db_warmup_failed", err: String(err) }));
  }
}

export async function register() {
  // Boot-time env check — pokreće se samo u Node runtime-u (Edge nema fs, ne
  // pokreće Prisma niti procesira cron, pa nema potrebe duplo zvati).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Kontejner u produkciji radi u UTC-u, pa bi svaki `toLocaleString()` i
    // svaki `getHours()` na serveru davao UTC — korisniku u Hrvatskoj to
    // izgleda kao da vrijeme kasni sat (zimi) ili dva (ljeti). Aplikacija se
    // koristi isključivo u Hrvatskoj, pa je Zagreb ispravan default.
    // Postavljeno kao default: ako je TZ eksplicitno zadan u okolini, poštujemo njega.
    if (!process.env.TZ) {
      process.env.TZ = "Europe/Zagreb";
    }

    try {
      const { validateLaunchEnv, reportLaunchEnv } = await import("@/lib/envChecks");
      reportLaunchEnv(validateLaunchEnv());
    } catch (err) {
      // U produkciji `reportLaunchEnv` baca — to je namjerno. Na taj način se
      // ne pokrene aplikacija s nedostatnim secretima.
      console.error(JSON.stringify({ lvl: "error", evt: "env_check_failed", err: String(err) }));
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }

    // Namjerno bez `await` — ne odgađamo start servera; retry u Prisma klijentu
    // pokriva zahtjeve koji stignu prije nego pool bude topao.
    void warmUpDatabase();
  }

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/nextjs");
    const { SENTRY_IGNORE_ERRORS, isNonActionableError } = await import("@/lib/sentryFilters");

    const shared = {
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      enabled: true,
      ignoreErrors: SENTRY_IGNORE_ERRORS,
      beforeSend(event: unknown, hint: { originalException?: unknown } | undefined) {
        // `redirect()` i `notFound()` rade tako da bacaju iznimku — to nije kvar.
        if (isNonActionableError(hint?.originalException)) return null;
        return event;
      },
    } as Parameters<typeof Sentry.init>[0];

    if (process.env.NEXT_RUNTIME === "nodejs") {
      Sentry.init({
        ...shared,
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
      });
    }

    if (process.env.NEXT_RUNTIME === "edge") {
      Sentry.init({ ...shared, tracesSampleRate: 0 });
    }

    // Expose captureException globalno da ga logger.ts može koristiti bez direktne ovisnosti.
    const g = globalThis as unknown as { __sentryCapture?: (e: unknown, ctx?: unknown) => void };
    g.__sentryCapture = (err, ctx) => {
      Sentry.captureException(err, ctx ? { contexts: { fields: ctx as Record<string, unknown> } } : undefined);
    };

    console.log(JSON.stringify({ lvl: "info", evt: "sentry_initialized", runtime: process.env.NEXT_RUNTIME }));
  } catch (err) {
    console.warn(JSON.stringify({ lvl: "warn", evt: "sentry_init_failed", err: String(err) }));
  }
}

export async function onRequestError(err: unknown, request: unknown, context: unknown) {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(err, request as Parameters<typeof Sentry.captureRequestError>[1], context as Parameters<typeof Sentry.captureRequestError>[2]);
  } catch {
    // ignore
  }
}
