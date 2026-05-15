import Link from "next/link";
import type { HealthItem, HealthLevel } from "./getPlatformHealth";

const LEVEL_STYLES: Record<HealthLevel, { dot: string; text: string; ring: string }> = {
  ok: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  warn: {
    dot: "bg-amber-500",
    text: "text-amber-700",
    ring: "ring-amber-200",
  },
  down: {
    dot: "bg-red-500",
    text: "text-red-700",
    ring: "ring-red-200",
  },
  off: {
    dot: "bg-slate-400",
    text: "text-slate-600",
    ring: "ring-slate-200",
  },
};

export function HealthStrip({ items }: { items: HealthItem[] }) {
  if (items.length === 0) return null;

  // Header "ukupno stanje" — najgori status određuje boju strip-a.
  const worst: HealthLevel = items.some((i) => i.level === "down")
    ? "down"
    : items.some((i) => i.level === "warn")
      ? "warn"
      : items.every((i) => i.level === "ok")
        ? "ok"
        : "off";

  const summary =
    worst === "ok"
      ? "Sve OK"
      : worst === "warn"
        ? "Treba pažnje"
        : worst === "down"
          ? "Problem"
          : "Dijelovi sustava nisu konfigurirani";

  return (
    <section
      aria-label="Operativni status"
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ${LEVEL_STYLES[worst].dot} ${LEVEL_STYLES[worst].ring}`}
            aria-hidden="true"
          />
          <span className={`text-xs font-semibold uppercase tracking-wide ${LEVEL_STYLES[worst].text}`}>
            {summary}
          </span>
        </div>
        {items.map((item) => {
          const style = LEVEL_STYLES[item.level];
          const inner = (
            <span
              key={item.key}
              title={item.detail}
              className="inline-flex items-center gap-1.5 text-xs"
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${style.dot}`}
                aria-hidden="true"
              />
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="hidden text-slate-500 sm:inline">·</span>
              <span className="hidden text-slate-500 sm:inline truncate max-w-[18ch] lg:max-w-[28ch]">
                {item.detail}
              </span>
            </span>
          );
          return item.href ? (
            <Link
              key={item.key}
              href={item.href}
              className="hover:opacity-80"
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {inner}
            </Link>
          ) : (
            <span key={item.key}>{inner}</span>
          );
        })}
      </div>
    </section>
  );
}
