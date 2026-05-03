export const APP_VERSION = "1.0.0";
export const APP_NAME = "VatroLog";

/** Baza URL-a aplikacije - koristi se u email linkovima, Stripe callbackovima, Sentry tagovima. */
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");
  return "http://localhost:3000";
}
