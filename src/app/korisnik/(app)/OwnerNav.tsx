"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/korisnik", label: "Pregled" },
  { href: "/korisnik/aparati", label: "Aparati" },
  { href: "/korisnik/pregledi", label: "Redovni pregledi", badgeKey: "inspectionDue" as const },
  { href: "/korisnik/nalozi", label: "Servisni nalozi" },
  { href: "/korisnik/dokumenti", label: "Dokumenti" },
];

export default function OwnerNav({ inspectionDueCount = 0 }: { inspectionDueCount?: number }) {
  const pathname = usePathname();
  return (
    <nav className="mx-auto max-w-6xl overflow-x-auto px-4">
      <ul className="flex gap-1 border-t border-slate-100 py-1">
        {ITEMS.map((it) => {
          const active = it.href === "/korisnik" ? pathname === "/korisnik" : pathname.startsWith(it.href);
          const showBadge = it.badgeKey === "inspectionDue" && inspectionDueCount > 0;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={[
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition",
                  active ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-100",
                ].join(" ")}
              >
                {it.label}
                {showBadge ? (
                  <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white">
                    {inspectionDueCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
