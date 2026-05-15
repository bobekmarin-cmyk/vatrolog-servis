import Link from "next/link";
import type { DashboardKpis } from "./getDashboardKpis";
import type { HealthItem } from "./getPlatformHealth";

type FocusItem = {
  key: string;
  label: string;
  href?: string;
  tone: "warning" | "info" | "danger";
};

/**
 * Generira dinamicki "Operativni fokus" iz stvarnih threshold-ova:
 *   - pending zahtjevi
 *   - tvrtke koje isticu u 7 dana
 *   - email greske u zadnjem mjesecu
 *   - health "warn"/"down" stavke
 * Ako je SVE OK i score-ovi sve zdrave → friendly empty state.
 */
export function OperationalFocus({
  kpis,
  health,
}: {
  kpis: DashboardKpis;
  health: HealthItem[];
}) {
  const items: FocusItem[] = [];

  if (kpis.pendingRequests > 0) {
    items.push({
      key: "pending",
      label: `${kpis.pendingRequests} ${kpis.pendingRequests === 1 ? "zahtjev ceka" : "zahtjeva ceka"} pregled`,
      href: "/platform/registration-requests?status=PENDING",
      tone: "warning",
    });
  }
  if (kpis.expiringSoon > 0) {
    items.push({
      key: "expiring",
      label: `${kpis.expiringSoon} ${kpis.expiringSoon === 1 ? "tvrtki istice" : "tvrtkama istice"} pretplata u ≤ 7 dana`,
      href: "/platform/companies?expires=7d",
      tone: "warning",
    });
  }
  if (kpis.emailFailuresMonth > 0) {
    items.push({
      key: "emailfail",
      label: `${kpis.emailFailuresMonth} email greska/-e ovaj mjesec — provjeri vendor Gmail / SMTP`,
      href: "/platform/email-log?status=FAILED",
      tone: "danger",
    });
  }

  for (const h of health) {
    if (h.level === "warn" || h.level === "down") {
      items.push({
        key: `health-${h.key}`,
        label: `${h.label}: ${h.detail}`,
        href: h.href,
        tone: h.level === "down" ? "danger" : "warning",
      });
    }
  }

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-base font-semibold text-emerald-900">
          Sve operacije su pod kontrolom ☕
        </h2>
        <p className="mt-1 text-sm text-emerald-700">
          Nema otvorenih zahtjeva, isteka pretplate ili email gresaka. Idealan
          trenutak za roadmap rad ili kontakt s novim trial korisnicima.
        </p>
        <Link
          href="/platform/audit"
          className="mt-3 inline-block text-xs font-medium text-emerald-800 hover:underline"
        >
          Pregledaj audit log →
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold">Operativni fokus</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it) => {
          const toneClass =
            it.tone === "danger"
              ? "text-red-700"
              : it.tone === "warning"
                ? "text-amber-700"
                : "text-sky-700";
          return (
            <li key={it.key} className="flex items-start gap-2">
              <span
                className={
                  "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full " +
                  (it.tone === "danger"
                    ? "bg-red-500"
                    : it.tone === "warning"
                      ? "bg-amber-500"
                      : "bg-sky-500")
                }
                aria-hidden="true"
              />
              {it.href ? (
                <Link href={it.href} className={`font-medium hover:underline ${toneClass}`}>
                  {it.label}
                </Link>
              ) : (
                <span className={toneClass}>{it.label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
