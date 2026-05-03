/**
 * Boot-time provjere kritičnih env varijabli.
 *
 * Cilj: u produkciji se ne smije pokrenuti instanca s nedostajućim ili slabim
 * tajnim ključevima i bez postavljene infrastrukture za rate-limit. U dev-u
 * pišemo samo upozorenja (lakše za pokretanje lokalno).
 */

const MIN_SECRET_LEN = 32;

type Severity = "error" | "warn" | "info";

type EnvIssue = { severity: Severity; key: string; message: string };

function checkSecret(key: string, label: string, isProd: boolean): EnvIssue | null {
  const v = process.env[key]?.trim() ?? "";
  if (!v) {
    return {
      severity: isProd ? "error" : "warn",
      key,
      message: `${label} (${key}) nije postavljen.`,
    };
  }
  if (v.length < MIN_SECRET_LEN) {
    return {
      severity: isProd ? "error" : "warn",
      key,
      message: `${label} (${key}) je prekratak (${v.length} znakova; minimum ${MIN_SECRET_LEN}).`,
    };
  }
  return null;
}

export function validateLaunchEnv(): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const isProd = process.env.NODE_ENV === "production";

  // Kritični secret-i (uvijek potrebni; u produkciji error, u dev-u warn).
  for (const [key, label] of [
    ["AUTH_SECRET", "Tenant JWT secret"],
    ["PLATFORM_AUTH_SECRET", "Platform JWT secret"],
    ["ENCRYPTION_KEY", "Encryption key za pohranu OAuth tokena"],
    ["DATABASE_URL", "PostgreSQL DATABASE_URL"],
  ] as const) {
    const i = checkSecret(key, label, isProd);
    if (i) issues.push(i);
  }

  // Ne smiju biti identični — sigurnosni razlog (rotacija JWT-a ne smije
  // razbiti enkripciju Gmail tokena i obrnuto).
  const auth = process.env.AUTH_SECRET?.trim();
  const enc = process.env.ENCRYPTION_KEY?.trim();
  const platform = process.env.PLATFORM_AUTH_SECRET?.trim();
  if (auth && enc && auth === enc) {
    issues.push({
      severity: isProd ? "error" : "warn",
      key: "ENCRYPTION_KEY",
      message:
        "ENCRYPTION_KEY mora biti različit od AUTH_SECRET-a (drugačije rotacija sesija pokvari Gmail integracije).",
    });
  }
  if (auth && platform && auth === platform) {
    issues.push({
      severity: isProd ? "error" : "warn",
      key: "PLATFORM_AUTH_SECRET",
      message: "PLATFORM_AUTH_SECRET mora biti različit od AUTH_SECRET-a.",
    });
  }

  // APP_BASE_URL — uvijek bolje da je eksplicitan, u produkciji error.
  if (!process.env.APP_BASE_URL?.trim()) {
    issues.push({
      severity: isProd ? "error" : "info",
      key: "APP_BASE_URL",
      message: "APP_BASE_URL nije postavljen — koristi se fallback (Vercel URL ili localhost).",
    });
  }

  // CRON_SECRET — vec hard-required u guardCronRequest u produkciji, ali
  // ako fali u prod buildu, neka launch upozori odmah, ne na prvi cron.
  if (isProd && !process.env.CRON_SECRET?.trim()) {
    issues.push({
      severity: "error",
      key: "CRON_SECRET",
      message: "CRON_SECRET nije postavljen — Vercel cron rute će vraćati 503.",
    });
  }

  // Rate-limit infra — u produkciji je in-memory limiter neprihvatljiv
  // (preboliven restart-om i ne dijeli se preko instanci).
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!upstashUrl || !upstashToken) {
    issues.push({
      severity: isProd ? "error" : "warn",
      key: "UPSTASH_REDIS_REST_URL",
      message:
        "Upstash Redis za rate-limit nije konfiguriran — koristi se in-memory fallback (neprihvatljiv u produkciji).",
    });
  }

  // PDF storage — u produkciji obavezno S3-kompatibilno (R2/B2/AWS), inače
  // se stvaraju lokalne datoteke koje se gube na restartu i nisu izolirane
  // između tenanata.
  const s3Endpoint = process.env.S3_ENDPOINT?.trim();
  const s3Bucket = process.env.S3_BUCKET?.trim();
  if (!s3Endpoint || !s3Bucket) {
    issues.push({
      severity: isProd ? "error" : "info",
      key: "S3_ENDPOINT",
      message:
        "S3 storage nije konfiguriran — PDF-ovi se zapisuju lokalno (samo dev / single-server).",
    });
  }

  // Mail kanal: u produkciji moramo imati barem jedan ispravan put.
  const hasGoogleClient =
    !!process.env.GOOGLE_CLIENT_ID?.trim() && !!process.env.GOOGLE_CLIENT_SECRET?.trim();
  const hasSmtp =
    !!process.env.SMTP_HOST?.trim() &&
    !!process.env.SMTP_USER?.trim() &&
    !!process.env.SMTP_PASS?.trim();
  if (isProd && !hasGoogleClient && !hasSmtp) {
    issues.push({
      severity: "error",
      key: "SMTP_HOST",
      message:
        "Niti Vendor Gmail (GOOGLE_CLIENT_ID/SECRET) niti SMTP nisu postavljeni — sistemski mailovi neće raditi.",
    });
  }

  return issues;
}

/**
 * Loga sve nalaze i (u produkciji) baca grešku ako ima `error`-a.
 * Ne baca u dev-u kako lokalni rad ne bi pucao.
 */
export function reportLaunchEnv(issues: EnvIssue[]): void {
  const isProd = process.env.NODE_ENV === "production";
  if (issues.length === 0) return;

  const errors = issues.filter((i) => i.severity === "error");
  const warns = issues.filter((i) => i.severity === "warn");
  const infos = issues.filter((i) => i.severity === "info");

  for (const i of [...errors, ...warns, ...infos]) {
    const evt = `env_check_${i.severity}`;
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ lvl: i.severity, evt, key: i.key, message: i.message }));
  }

  if (isProd && errors.length > 0) {
    const list = errors.map((i) => `${i.key}: ${i.message}`).join("\n  - ");
    throw new Error(
      `Greška: nedostaju ili neispravne kritične env varijable u produkciji:\n  - ${list}`,
    );
  }
}
