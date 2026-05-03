"use client";

import { type ExtStatus } from "@/lib/extinguisherStatus";

const CFG: Record<ExtStatus, { bg: string; label: string }> = {
  serviced: { bg: "bg-emerald-600", label: "Servisiran" },
  expired:  { bg: "bg-amber-500",   label: "Istekao servis" },
  scrapped: { bg: "bg-rose-600",    label: "Rashodovan" },
};

const CheckSvg = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const XSvg = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

const WarnSvg = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 8v5" />
    <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export default function ExtinguisherStatusIcon({ status }: { status: ExtStatus }) {
  const c = CFG[status];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-white ${c.bg}`}
        title={c.label}
        aria-label={c.label}
      >
        {status === "serviced" && <CheckSvg />}
        {status === "expired" && <WarnSvg />}
        {status === "scrapped" && <XSvg />}
      </span>
      {status !== "serviced" && (
        <span className={`text-xs font-medium ${status === "scrapped" ? "text-rose-700" : "text-amber-700"}`}>
          {c.label}
        </span>
      )}
    </span>
  );
}
