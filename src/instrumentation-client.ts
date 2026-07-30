/**
 * Sentry u pregledniku.
 *
 * Do sada se pratio samo server, pa greške koje se dogode nakon što HTML stigne
 * — a to su sve greške u React komponentama i hidraciji — nisu nigdje završile.
 * Upravo takva greška je rušila detalj radnog naloga, a u Sentryju je nije bilo.
 *
 * DSN je javan po dizajnu (šalje se u browser), zato ide kao NEXT_PUBLIC_.
 */
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DENY_URLS, SENTRY_IGNORE_ERRORS, isNonActionableError } from "@/lib/sentryFilters";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Bez tracinga i replaya — zanimaju nas greške, a ne dodatnih ~100 kB u bundleu.
    tracesSampleRate: 0,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    denyUrls: SENTRY_DENY_URLS,
    beforeSend(event, hint) {
      if (isNonActionableError(hint?.originalException)) return null;
      return event;
    },
  });
}

/** Next.js traži ovaj export za praćenje navigacije na klijentu. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
