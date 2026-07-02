"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };
type TabGroup = { label: string; accent?: "default" | "code"; tabs: Tab[] };

const GROUPS: TabGroup[] = [
  {
    label: "Općenito",
    tabs: [
      { href: "/admin/settings", label: "Postavke tvrtke" },
      { href: "/admin/settings/mail", label: "Postavke maila" },
      { href: "/admin/settings/servicers", label: "Serviseri" },
    ],
  },
  {
    label: "Šifrarnici",
    accent: "code",
    tabs: [
      { href: "/admin/settings/services", label: "Usluge" },
      { href: "/admin/settings/parts", label: "Rezervni dijelovi" },
      { href: "/admin/settings/authorizations", label: "Ovlaštenja" },
    ],
  },
  {
    label: "Sustav",
    tabs: [
      { href: "/admin/settings/integrations", label: "Integracije" },
      { href: "/admin/settings/billing", label: "Pretplata" },
      { href: "/admin/settings/audit", label: "Audit log" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin/settings") return pathname === "/admin/settings";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminSettingsTabs() {
  const pathname = usePathname() ?? "";

  return (
    <div className="mb-6 border-b border-slate-200">
      <div className="flex flex-wrap items-end gap-x-1">
        {GROUPS.map((group, gi) => {
          const isCodeGroup = group.accent === "code";
          return (
            <Fragment key={group.label}>
              {gi > 0 ? (
                <div className="mx-2 mb-2 hidden h-7 w-px self-end bg-slate-200 md:block" />
              ) : null}
              <div
                className={
                  "flex flex-col " +
                  (isCodeGroup
                    ? "rounded-t-md border-l-2 border-l-red-600 bg-slate-50 px-2 pt-1.5 shadow-sm ring-1 ring-slate-200/80"
                    : "")
                }
              >
                <div
                  className={
                    "px-2 text-[10px] font-semibold uppercase tracking-wider " +
                    (isCodeGroup ? "text-slate-600" : "text-slate-400")
                  }
                >
                  {group.label}
                </div>
                <div className="flex flex-wrap">
                  {group.tabs.map((t) => {
                    const active = isActive(pathname, t.href);
                    return (
                      <Link
                        key={t.href}
                        href={t.href}
                        className={[
                          "px-3 py-2 text-sm font-medium -mb-px transition-colors whitespace-nowrap",
                          active
                            ? isCodeGroup
                              ? "border-b-2 border-red-600 text-slate-900"
                              : "border-b-2 border-slate-900 text-slate-900"
                            : isCodeGroup
                              ? "text-slate-600 hover:text-slate-900"
                              : "text-slate-500 hover:text-slate-700",
                        ].join(" ")}
                        aria-current={active ? "page" : undefined}
                      >
                        {t.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
