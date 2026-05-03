import Link from "next/link";

type Props = {
  /** Apsolutni path stranice (npr. "/work-orders"). */
  basePath: string;
  /** Trenutni query parametri (bez `page`) — bit ce ocuvani u linkovima. */
  params?: Record<string, string | number | undefined | null>;
  /** Trenutna stranica (1-indexed). */
  page: number;
  /** Broj redaka po stranici. */
  pageSize: number;
  /** Ukupan broj rezultata (bez paginacije). */
  total: number;
  /** Naziv parametra za paginaciju (default "page"). */
  pageParam?: string;
};

function buildHref(basePath: string, pageParam: string, page: number, params?: Props["params"]) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      const s = String(v).trim();
      if (s.length === 0) continue;
      qs.set(k, s);
    }
  }
  if (page > 1) qs.set(pageParam, String(page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export default function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
  pageParam = "page",
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);

  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-600">
        <span>Ukupno: {total}</span>
      </div>
    );
  }

  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  // Kompaktan niz stranica: uvijek 1, current-1, current, current+1, totalPages (s elipsama).
  const pages = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const ordered = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const rendered: Array<number | "..."> = [];
  for (let i = 0; i < ordered.length; i++) {
    if (i > 0 && ordered[i] - ordered[i - 1] > 1) rendered.push("...");
    rendered.push(ordered[i]);
  }

  const prevHref = buildHref(basePath, pageParam, Math.max(1, current - 1), params);
  const nextHref = buildHref(basePath, pageParam, Math.min(totalPages, current + 1), params);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-slate-600">
      <span>
        Prikaz {from}–{to} od {total}
      </span>
      <nav className="inline-flex items-center gap-1" aria-label="Paginacija">
        <Link
          href={prevHref}
          aria-disabled={current <= 1}
          className={[
            "inline-flex h-7 items-center rounded-md border px-2 leading-none",
            current <= 1
              ? "pointer-events-none border-slate-200 text-slate-300"
              : "border-slate-200 text-slate-600 hover:bg-slate-50",
          ].join(" ")}
        >
          ← Prethodna
        </Link>
        {rendered.map((p, idx) =>
          p === "..." ? (
            <span key={`e${idx}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={buildHref(basePath, pageParam, p, params)}
              className={[
                "inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border px-2 leading-none",
                p === current
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50",
              ].join(" ")}
              aria-current={p === current ? "page" : undefined}
            >
              {p}
            </Link>
          )
        )}
        <Link
          href={nextHref}
          aria-disabled={current >= totalPages}
          className={[
            "inline-flex h-7 items-center rounded-md border px-2 leading-none",
            current >= totalPages
              ? "pointer-events-none border-slate-200 text-slate-300"
              : "border-slate-200 text-slate-600 hover:bg-slate-50",
          ].join(" ")}
        >
          Sljedeća →
        </Link>
      </nav>
    </div>
  );
}
