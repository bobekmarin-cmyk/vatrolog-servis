"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// pendingHref se čisti implicitno: dok traje transition koristimo ga za highlight,
// inače pathname (bez setState u effectu).

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

const ALL_HREFS = GROUPS.flatMap((g) => g.tabs.map((t) => t.href));

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin/settings") return pathname === "/admin/settings";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminSettingsTabs() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Optimistički aktivni tab dok RSC navigacija traje.
  const displayPath = isPending && pendingHref ? pendingHref : pathname;

  // Prefetch svih tabova čim se shell učita — sljedeći klik ide iz keša kad je moguće.
  useEffect(() => {
    for (const href of ALL_HREFS) {
      router.prefetch(href);
    }
  }, [router]);

  return (
    <div className="mb-6 border-b border-slate-200" data-pending={isPending ? "1" : undefined}>
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
                    const active = isActive(displayPath, t.href);
                    return (
                      <Link
                        key={t.href}
                        href={t.href}
                        prefetch
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                            return;
                          }
                          e.preventDefault();
                          if (isActive(pathname, t.href) && !isPending) return;
                          setPendingHref(t.href);
                          startTransition(() => {
                            router.push(t.href);
                          });
                        }}
                        className={[
                          "px-3 py-2 text-sm font-medium -mb-px transition-colors whitespace-nowrap",
                          active
                            ? isCodeGroup
                              ? "border-b-2 border-red-600 text-slate-900"
                              : "border-b-2 border-slate-900 text-slate-900"
                            : isCodeGroup
                              ? "text-slate-600 hover:text-slate-900"
                              : "text-slate-500 hover:text-slate-700",
                          isPending && active ? "opacity-80" : "",
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
