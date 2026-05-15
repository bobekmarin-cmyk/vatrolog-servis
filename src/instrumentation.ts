/**
 * Next.js instrumentation hook — pokreće se jednom po runtime procesu.
 * Inicijalizira Sentry ako je SENTRY_DSN postavljen u env-u.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Boot-time env check — pokreće se samo u Node runtime-u (Edge nema fs, ne
  // pokreće Prisma niti procesira cron, pa nema potrebe duplo zvati).
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
