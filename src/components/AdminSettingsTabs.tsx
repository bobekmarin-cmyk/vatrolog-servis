"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

const TABS: Tab[] = [
  { href: "/admin/settings", label: "Postavke tvrtke" },
  { href: "/admin/settings/mail", label: "Postavke maila" },
  { href: "/admin/settings/servicers", label: "Serviseri" },
  { href: "/admin/settings/services", label: "Šifre usluga" },
  { href: "/admin/settings/authorizations", label: "Ovlaštenja" },
  { href: "/admin/settings/billing", label: "Pretplata" },
  { href: "/admin/settings/audit", label: "Audit log" },
  { href: "/admin/settings/account", label: "Moj račun" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin/settings") return pathname === "/admin/settings";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminSettingsTabs() {
  const pathname = usePathname() ?? "";

  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={[
              "px-4 py-2.5 text-sm font-medium -mb-px transition-colors whitespace-nowrap",
              active
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

