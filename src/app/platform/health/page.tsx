import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import { getVendorStatus } from "@/lib/platformGmail";
import { listRecentBackups, formatBytes } from "@/lib/backupListing";
import { validateLaunchEnv, type EnvIssue } from "@/lib/envChecks";
import { getBillingMode } from "@/lib/billing";

/** Bez DB na buildu — i ova stranica radi prave queries. */
export const dynamic = "force-dynamic";

type DbCheck = { ok: boolean; latencyMs: number | null; error: string | null };

async function checkDb(): Promise<DbCheck> {
  const t0 = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return { ok: true, latencyMs: Date.now() - t0, error: null };
  } catch (err) {
    return {
      ok: false,
      latencyMs: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function maskUrl(url: string | undefined): string {
  if (!url) return "—";
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    if (u.username) u.username = u.username.replace(/.(?=.{3})/g, "*");
    return u.toString();
  } catch {
    return url.replace(/:[^@/]+@/, ":***@");
  }
}

const SEVERITY_TONE: Record<EnvIssue["severity"], { dot: string; pill: string; label: string }> = {
  error: {
    dot: "bg-red-500",
    pill: "bg-red-100 text-red-800 ring-1 ring-red-200",
    label: "ERROR",
  },
  warn: {
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    label: "WARN",
  },
  info: {
    dot: "bg-sky-500",
    pill: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
    label: "INFO",
  },
};

function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusDot({ tone }: { tone: "ok" | "warn" | "off" | "down" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
        ? "bg-amber-500"
        : tone === "down"
          ? "bg-red-500"
          : "bg-slate-400";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} aria-hidden="true" />;
}

function Row({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "ok" | "warn" | "off" | "down";
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        {tone ? <StatusDot tone={tone} /> : null}
        <span>{label}</span>
      </div>
      <div className="text-right text-sm">
        <div className="font-medium text-slate-900">{value}</div>
        {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
      </div>
    </div>
  );
}

export default async function PlatformHealthPage() {
  await requirePlatformSession();

  const [db, vendor, backups, issues] = await Promise.all([
    checkDb(),
    getVendorStatus(),
    listRecentBackups(10),
    Promise.resolve(validateLaunchEnv()),
  ]);

  const billingMode = getBillingMode();
  const errorsCount = issues.filter((i) => i.severity === "error").length;
  const warnsCount = issues.filter((i) => i.severity === "warn").length;

  const sentryConfigured = !!process.env.SENTRY_DSN?.trim();
  const upstashConfigured =
    !!process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  const sentryEnv = process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || "—";
  const sentryTrace = process.env.SENTRY_TRACES_SAMPLE_RATE?.trim() || "default";

  // Brand info za R2/Sentry/Upstash linkove
  const githubBackupUrl =
    process.env.GITHUB_REPO?.includes("/")
      ? `https://github.com/${process.env.GITHUB_REPO}/actions/workflows/backup-db.yml`
      : "https://github.com/bobekmarin-cmyk/vatrolog-servis/actions/workflows/backup-db.yml";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Zdravlje sustava</h1>
          <p className="text-sm text-slate-600">
            Detaljan presjek konfiguracije, baze, backup-a i integracija. Read-only
            stranica koja se uvijek izvršava na zahtjev.
          </p>
        </div>
        <Link
          href="/platform"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Dashboard
        </Link>
      </div>

      {/* DB latency + connection mask */}
      <Section title="Baza podataka (PostgreSQL)">
        <div className="space-y-1">
          <Row
            label="SELECT 1 ping"
            tone={db.ok ? "ok" : "down"}
            value={db.ok ? "OK" : "FAIL"}
            hint={
              db.ok
                ? `${db.latencyMs} ms`
                : (db.error ?? "Greska bez detalja")
            }
          />
          <Row
            label="DATABASE_URL"
            value={
              <span className="font-mono text-xs text-slate-600">
                {maskUrl(process.env.DATABASE_URL)}
              </span>
            }
          />
          <Row
            label="Prisma migrations"
            value={
              <Link
                href={githubBackupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-sky-700 hover:underline"
              >
                Provjeri u GH Actions
              </Link>
            }
            hint="Deploy izvodi `prisma migrate deploy` automatski"
          />
        </div>
      </Section>

      {/* Backup history (10) iz R2 */}
      <Section
        title="Backup arhiva (R2)"
        right={
          <Link
            href={githubBackupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            GitHub Actions workflow →
          </Link>
        }
      >
        {!backups.configured ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {backups.errorMessage}
          </div>
        ) : !backups.ok ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Citanje bucketa nije uspjelo:{" "}
            <span className="font-mono">{backups.errorMessage}</span>
          </div>
        ) : backups.objects.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Bucket je prazan — niti jedan backup nije zapisan. Pokreni workflow rucno.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 font-semibold">Datum</th>
                  <th className="py-2 font-semibold">Veličina</th>
                  <th className="py-2 font-semibold">Key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.objects.map((o) => (
                  <tr key={o.key}>
                    <td className="py-2 pr-3 tabular-nums">
                      {o.lastModified.toLocaleString("hr-HR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {formatBytes(o.size)}
                    </td>
                    <td className="py-2 font-mono text-xs text-slate-500">{o.key}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">
              Bucket: <code>{backups.bucket}</code> · Prefix:{" "}
              <code>{backups.prefix}</code>
            </p>
          </div>
        )}
      </Section>

      {/* Sentry, Upstash, Vendor Gmail */}
      <Section title="Integracije & infra">
        <div className="space-y-1">
          <Row
            label="Sentry DSN"
            tone={sentryConfigured ? "ok" : "off"}
            value={sentryConfigured ? "Postavljen" : "Nije postavljen"}
            hint={
              sentryConfigured
                ? `env=${sentryEnv} · trace=${sentryTrace}`
                : "Greske se loga ju samo lokalno"
            }
          />
          <Row
            label="Upstash Redis (rate-limit)"
            tone={upstashConfigured ? "ok" : "warn"}
            value={upstashConfigured ? "Spojen" : "In-memory fallback"}
            hint={
              upstashConfigured
                ? "Distribuirani limit preko instanci"
                : "Resetira se na restart — prihvatljivo samo u dev-u"
            }
          />
          <Row
            label="Vendor Gmail"
            tone={vendor.connected ? "ok" : "warn"}
            value={vendor.connected ? vendor.email ?? "Spojen" : "Nije povezan"}
            hint={
              vendor.connected
                ? vendor.connectedAt
                  ? `Povezan ${vendor.connectedAt.toLocaleString("hr-HR")}`
                  : null
                : "Sistemski mailovi mogu pasti — povezi u /platform/settings"
            }
          />
          <Row
            label="Billing mode"
            tone={billingMode === "stripe" ? "ok" : "off"}
            value={billingMode}
            hint={
              billingMode === "stripe"
                ? "Stripe SaaS"
                : "Rucna naplata (bez Stripe webhook-a)"
            }
          />
        </div>
      </Section>

      {/* Env varijable checklist */}
      <Section
        title="Env varijable"
        right={
          <span className="text-xs text-slate-500">
            {issues.length === 0
              ? "Sve OK ✓"
              : `${errorsCount} error · ${warnsCount} warn · ${issues.length - errorsCount - warnsCount} info`}
          </span>
        }
      >
        {issues.length === 0 ? (
          <p className="text-sm text-emerald-700">
            Sve provjere prolaze — niti jedan kriticni var nije postavljen pogresno.
          </p>
        ) : (
          <ul className="space-y-2">
            {issues.map((i, idx) => {
              const t = SEVERITY_TONE[i.severity];
              return (
                <li
                  key={`${i.key}-${idx}`}
                  className="flex items-start gap-3 rounded-md border border-slate-100 px-3 py-2"
                >
                  <span
                    className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${t.dot}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.pill}`}
                      >
                        {t.label}
                      </span>
                      <code className="font-mono text-xs text-slate-700">{i.key}</code>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{i.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
