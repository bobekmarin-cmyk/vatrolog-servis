import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkline } from "./Sparkline";
import type { DashboardKpis } from "./getDashboardKpis";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-slate-200 bg-white text-slate-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};

const TREND_COLOR: Record<Tone, string> = {
  neutral: "text-slate-400",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-red-500",
  info: "text-sky-500",
};

function Card({
  label,
  value,
  tone = "neutral",
  hint,
  href,
  trend,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  hint?: string;
  href?: string;
  trend?: number[];
}) {
  const inner = (
    <div
      className={`rounded-lg border px-3 py-2 shadow-sm transition-shadow ${TONE_CLASS[tone]} ${href ? "hover:shadow-md" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
          {label}
        </div>
        {trend ? (
          <Sparkline
            values={trend}
            className={TREND_COLOR[tone]}
            ariaLabel={`Trend 30 dana: ukupno ${trend.reduce((a, b) => a + b, 0)}`}
          />
        ) : null}
      </div>
      <div className="mt-0.5 text-2xl font-bold leading-tight tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] opacity-70">{hint}</div> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {children}
    </h2>
  );
}

export function KpiGroups({ kpis }: { kpis: DashboardKpis }) {
  const {
    pendingRequests,
    signupsThisMonth,
    signupsTrend,
    totalCompanies,
    activeCompanies,
    trialCompanies,
    expiringSoon,
    emailFailuresMonth,
    emailFailuresTrend,
  } = kpis;

  return (
    <div className="space-y-3">
      {/* Pipeline / akvizicija */}
      <section>
        <SectionTitle>Pipeline · akvizicija</SectionTitle>
        <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            label="Zahtjevi za pregled"
            value={pendingRequests}
            tone={pendingRequests > 0 ? "warning" : "success"}
            hint={pendingRequests > 0 ? "Otvori i odluči" : "Sve riješeno ☕"}
            href="/platform/registration-requests?status=PENDING"
          />
          <Card
            label="Signup ovaj mjesec"
            value={signupsThisMonth}
            tone="info"
            hint={`${signupsTrend.reduce((a, b) => a + b, 0)} u 30d`}
            trend={signupsTrend}
            href="/platform/companies"
          />
        </div>
      </section>

      {/* Aktivnost / retencija */}
      <section>
        <SectionTitle>Aktivnost · retencija</SectionTitle>
        <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            label="Tvrtke ukupno"
            value={totalCompanies}
            href="/platform/companies"
          />
          <Card
            label="Aktivne pretplate"
            value={activeCompanies}
            tone="success"
            href="/platform/companies?status=active"
          />
          <Card
            label="Trial"
            value={trialCompanies}
            tone="info"
            hint="30-dnevni probni period"
            href="/platform/companies?status=trial"
          />
          <Card
            label="Ističe ≤ 7 dana"
            value={expiringSoon}
            tone={expiringSoon > 0 ? "warning" : "success"}
            hint={expiringSoon > 0 ? "Kontaktiraj prije isteka" : "Nema isteka u tjednu"}
            href="/platform/companies?expires=7d"
          />
        </div>
      </section>

      {/* Operativa / zdravlje */}
      <section>
        <SectionTitle>Operativa · zdravlje</SectionTitle>
        <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            label="Email greške / mjesec"
            value={emailFailuresMonth}
            tone={emailFailuresMonth > 0 ? "danger" : "success"}
            hint={emailFailuresMonth > 0 ? "Provjeri vendor Gmail / SMTP" : "Sve dostavljeno ✓"}
            trend={emailFailuresTrend}
            href="/platform/email-log?status=FAILED"
          />
          <Card
            label="System health"
            value={<span className="text-sm font-semibold">Otvori →</span>}
            tone="neutral"
            hint="Backup, Sentry, Upstash, DB"
            href="/platform/health"
          />
        </div>
      </section>
    </div>
  );
}
