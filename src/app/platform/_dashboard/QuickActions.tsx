import Link from "next/link";
import type { ReactNode } from "react";

type Action = {
  label: string;
  href: string;
  icon: ReactNode;
  external?: boolean;
  hint?: string;
};

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19a4.5 4.5 0 1 0-1.62-8.7A6 6 0 0 0 5 14a5 5 0 0 0 5 5h7.5Z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** GitHub workflow URL za rucno pokretanje backup-a. Default tocan repo. */
function backupWorkflowUrl(): string {
  const repo = process.env.GITHUB_REPO?.trim();
  if (repo && repo.includes("/")) {
    return `https://github.com/${repo}/actions/workflows/backup-db.yml`;
  }
  return "https://github.com/bobekmarin-cmyk/vatrolog-servis/actions/workflows/backup-db.yml";
}

/** Sentry dashboard URL — uzima ENV ili pada na opci sentry.io. */
function sentryUrl(): string | null {
  if (!process.env.SENTRY_DSN) return null;
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  if (org && project) return `https://${org}.sentry.io/issues/?project=${project}`;
  if (org) return `https://${org}.sentry.io/issues/`;
  return "https://sentry.io/";
}

export function QuickActions() {
  const actions: Action[] = [
    {
      label: "Nova tvrtka",
      href: "/platform/companies/new",
      icon: <PlusIcon />,
      hint: "Kreiraj tenant ručno",
    },
    {
      label: "Pošalji obavijest",
      href: "/platform/notifications/new",
      icon: <BellIcon />,
      hint: "Email/banner svim tvrtkama",
    },
    {
      label: "Pokreni backup",
      href: backupWorkflowUrl(),
      icon: <DatabaseIcon />,
      external: true,
      hint: "GitHub Actions · Run workflow",
    },
  ];

  const sentry = sentryUrl();
  if (sentry) {
    actions.push({
      label: "Sentry",
      href: sentry,
      icon: <AlertIcon />,
      external: true,
      hint: "Pregled grešaka",
    });
  }

  if (process.env.S3_ENDPOINT) {
    actions.push({
      label: "Cloudflare R2",
      href: "https://dash.cloudflare.com/?to=/:account/r2",
      icon: <CloudIcon />,
      external: true,
      hint: "Bucket s backup-ima",
    });
  }

  actions.push({
    label: "Audit log",
    href: "/platform/audit",
    icon: <HistoryIcon />,
    hint: "Sve akcije + filteri",
  });

  const buttonClass =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300";

  return (
    <section aria-label="Brze akcije" className="flex flex-wrap gap-2">
      {actions.map((a) =>
        a.external ? (
          <a
            key={a.label}
            href={a.href}
            target="_blank"
            rel="noopener noreferrer"
            title={a.hint}
            className={buttonClass}
          >
            {a.icon}
            <span>{a.label}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-50"
            >
              <path d="M7 17 17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        ) : (
          <Link key={a.label} href={a.href} title={a.hint} className={buttonClass}>
            {a.icon}
            <span>{a.label}</span>
          </Link>
        ),
      )}
    </section>
  );
}
