import Link from "next/link";
import type { RecentActivityEntry } from "@/lib/auditLog";

type Tone = "neutral" | "success" | "info" | "warning" | "danger";

type ActionMeta = {
  label: string;
  tone: Tone;
  icon: string;
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

/**
 * Mapira audit action na ljudski-citljivu poruku + boju + ikonu.
 * Pattern match: prvo egzaktan, pa prefix, pa fallback.
 */
function describeAction(action: string): ActionMeta {
  // Egzaktni hitovi (najprecizniji)
  const exact: Record<string, ActionMeta> = {
    "platform.googleLogin.success": { label: "Google prijava", tone: "success", icon: "🔑" },
    "platform.googleLogin.exchange_failed": {
      label: "Google prijava — token failed",
      tone: "danger",
      icon: "⛔",
    },
    "platform.googleLogin.not_allowlisted": {
      label: "Google prijava — nije na allowlist-u",
      tone: "warning",
      icon: "🚫",
    },
    "platform.googleLogin.no_match": {
      label: "Google prijava — nema racuna",
      tone: "warning",
      icon: "❓",
    },
    "registration_request.approve": {
      label: "Zahtjev odobren",
      tone: "success",
      icon: "✅",
    },
    "registration_request.reject": {
      label: "Zahtjev odbijen",
      tone: "warning",
      icon: "🚷",
    },
    "registration_request.resend_ack": {
      label: "Zahtjev — re-send potvrde",
      tone: "info",
      icon: "📨",
    },
    "registration_request.resend_alert": {
      label: "Zahtjev — re-send alert-a",
      tone: "info",
      icon: "📨",
    },
    "company.impersonate.start": {
      label: "Impersonate start",
      tone: "warning",
      icon: "👤",
    },
    "company.impersonate.stop": {
      label: "Impersonate stop",
      tone: "neutral",
      icon: "👤",
    },
    "company.impersonate.write.enable": {
      label: "Impersonate write-mode ON",
      tone: "danger",
      icon: "✍️",
    },
    "company.impersonate.write.disable": {
      label: "Impersonate write-mode OFF",
      tone: "neutral",
      icon: "✍️",
    },
    "platform.subscription.block": {
      label: "Tvrtka blokirana",
      tone: "danger",
      icon: "🔒",
    },
    "platform.subscription.expire": {
      label: "Pretplata istekla",
      tone: "warning",
      icon: "⏰",
    },
    "subscription.updated": {
      label: "Pretplata azurirana",
      tone: "info",
      icon: "💳",
    },
    "platform.account.create": {
      label: "Tenant racun kreiran",
      tone: "success",
      icon: "🏢",
    },
    "platform.account.force-logout": {
      label: "Tenant force logout",
      tone: "warning",
      icon: "🚪",
    },
    "platform.gmail.connect": {
      label: "Vendor Gmail povezan",
      tone: "success",
      icon: "📧",
    },
    "platform.gmail.disconnect": {
      label: "Vendor Gmail odvojen",
      tone: "warning",
      icon: "📧",
    },
    "platform.gmail.test-send": {
      label: "Test mail iz Gmail-a",
      tone: "info",
      icon: "📧",
    },
    "password.reset": { label: "Reset lozinke", tone: "info", icon: "🔑" },
  };
  if (exact[action]) return exact[action];

  // Prefix match
  if (action.startsWith("workOrder.")) {
    return { label: humanize(action), tone: "info", icon: "📋" };
  }
  if (action.startsWith("customer.")) {
    return { label: humanize(action), tone: "info", icon: "👥" };
  }
  if (action.startsWith("part") || action.startsWith("stock")) {
    return { label: humanize(action), tone: "neutral", icon: "📦" };
  }
  if (action.startsWith("platform.")) {
    return { label: humanize(action), tone: "neutral", icon: "⚙️" };
  }
  if (action.startsWith("account.")) {
    return { label: humanize(action), tone: "info", icon: "👤" };
  }
  if (action.startsWith("dsar.")) {
    return { label: humanize(action), tone: "warning", icon: "🛡️" };
  }
  // fallback
  return { label: action, tone: "neutral", icon: "·" };
}

function humanize(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\./g, " · ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Vrijeme prije: "prije 3 min", "prije 2 h", "prije 4 d".
 */
function timeAgo(d: Date, now: Date = new Date()): string {
  const ms = Math.max(0, now.getTime() - d.getTime());
  const s = Math.floor(ms / 1000);
  if (s < 60) return "upravo";
  const m = Math.floor(s / 60);
  if (m < 60) return `prije ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `prije ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `prije ${days} d`;
  const months = Math.floor(days / 30);
  return `prije ${months} mj`;
}

function shortMeta(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  // Citamo nekoliko poznatih kljuceva, jednostavna prezentacija.
  const candidates = ["email", "reason", "error", "from", "to", "name", "newName"];
  for (const k of candidates) {
    const v = meta[k];
    if (typeof v === "string" && v.length > 0) {
      return v.length > 60 ? v.slice(0, 57) + "..." : v;
    }
  }
  return null;
}

export function RecentActivityFeed({ entries }: { entries: RecentActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">Posljednje aktivnosti</h2>
        <p className="mt-2 text-sm text-slate-500">
          Audit log je prazan. Aktivnosti će se pojaviti čim se nešto dogodi.
        </p>
      </section>
    );
  }

  const now = new Date();

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 className="text-base font-semibold">Posljednje aktivnosti</h2>
        <Link
          href="/platform/audit"
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          Otvori puni log →
        </Link>
      </div>
      <ul className="divide-y divide-slate-100">
        {entries.map((e) => {
          const meta = describeAction(e.action);
          const detail = shortMeta(e.meta);
          return (
            <li key={e.id} className="flex items-start gap-3 px-5 py-3">
              <span
                className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center"
                aria-hidden="true"
              >
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${TONE_DOT[meta.tone]}`}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-slate-900">{meta.label}</span>
                  {e.companyName ? (
                    <span className="truncate text-slate-500">· {e.companyName}</span>
                  ) : (
                    <span className="text-slate-400">· sustav</span>
                  )}
                </div>
                {detail ? (
                  <div className="mt-0.5 truncate text-xs text-slate-500">{detail}</div>
                ) : null}
                <div className="mt-0.5 text-[11px] text-slate-400">
                  <span title={e.createdAt.toISOString()}>{timeAgo(e.createdAt, now)}</span>
                  <span className="mx-1">·</span>
                  <span className="font-mono">{e.action}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
