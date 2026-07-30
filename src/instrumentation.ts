/**
 * Next.js instrumentation hook — pokreće se jednom po runtime procesu.
 * Inicijalizira Sentry ako je SENTRY_DSN postavljen u env-u.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

/**
 * Railway private networking (`*.railway.internal`) razrješava se samo na IPv6.
 * Node bez ovoga zna prvo probati IPv4 zapis i javiti "Can't reach database
 * server" dok se kontejnerski DNS ne slegne nakon boota.
 */
async function preferIpv6ForRailwayInternal() {
  const host = process.env.DATABASE_URL?.trim();
  if (!host || !host.includes(".railway.internal")) return;
  try {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv6first");
  } catch {
    // ignore
  }
}

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
    await preferIpv6ForRailwayInternal();
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

    if (process.env.NEXT_RUNTIME === "nodejs") {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? "development",
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
        enabled: true,
      });
    }

    if (process.env.NEXT_RUNTIME === "edge") {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? "development",
        tracesSampleRate: 0,
        enabled: true,
      });
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
