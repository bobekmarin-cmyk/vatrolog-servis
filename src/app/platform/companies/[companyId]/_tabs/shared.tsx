import type { ReactNode } from "react";

/**
 * Vraca formatirani datum (kratki HR format).
 */
export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtEur(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
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

export function KpiTile({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  hint?: string;
}) {
  const toneCls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "danger"
          ? "border-red-200 bg-red-50 text-red-900"
          : tone === "info"
            ? "border-sky-200 bg-sky-50 text-sky-900"
            : "border-slate-200 bg-white text-slate-800";
  return (
    <div className={`rounded-lg border px-3 py-2 shadow-sm ${toneCls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-0.5 text-2xl font-bold leading-tight tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] opacity-70">{hint}</div> : null}
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  SCRAPPED: "bg-slate-200 text-slate-700 ring-1 ring-slate-300",
  LOST: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  DRAFT: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  IN_PROGRESS: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
  LOCKED: "bg-red-100 text-red-800 ring-1 ring-red-200",
  SENT: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  FAILED: "bg-red-100 text-red-800 ring-1 ring-red-200",
  BOUNCED: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  ISSUED: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
  PAID: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  VOID: "bg-slate-200 text-slate-600 ring-1 ring-slate-300",
  OVERDUE: "bg-red-100 text-red-800 ring-1 ring-red-200",
};

export function StatusPill({ status }: { status: string }) {
  const cls =
    STATUS_BADGE[status] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}
    >
      {status}
    </span>
  );
}
