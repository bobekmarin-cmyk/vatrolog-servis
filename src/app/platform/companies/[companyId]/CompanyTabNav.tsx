"use client";

import Link from "next/link";

export type CompanyTab = {
  id: string;
  label: string;
  badge?: number | string | null;
  badgeTone?: "neutral" | "warning" | "danger";
};

const BADGE_TONE: Record<NonNullable<CompanyTab["badgeTone"]>, string> = {
  neutral: "bg-slate-200 text-slate-700",
  warning: "bg-amber-200 text-amber-900",
  danger: "bg-red-200 text-red-900",
};

export default function CompanyTabNav({
  companyId,
  tabs,
  activeTab,
}: {
  companyId: string;
  tabs: CompanyTab[];
  activeTab: string;
}) {
  return (
    <nav
      aria-label="Detalji tvrtke"
      className="flex flex-wrap gap-1 border-b border-slate-200"
    >
      {tabs.map((t) => {
        const isActive = t.id === activeTab;
        const href =
          t.id === "overview"
            ? `/platform/companies/${companyId}`
            : `/platform/companies/${companyId}?tab=${t.id}`;
        return (
          <Link
            key={t.id}
            href={href}
            scroll={false}
            className={
              "inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium -mb-px transition-colors " +
              (isActive
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700")
            }
          >
            {t.label}
            {t.badge !== undefined && t.badge !== null && t.badge !== 0 ? (
              <span
                className={
                  "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] tabular-nums " +
                  BADGE_TONE[t.badgeTone ?? "neutral"]
                }
              >
                {t.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
