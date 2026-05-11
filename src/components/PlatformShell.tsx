"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import NowDateTime from "@/components/NowDateTime";
import PlatformLogoutButton from "@/components/PlatformLogoutButton";

export type PlatformNavItem = {
  href: string;
  label: string;
  icon?: string;
};

function NavItem({ href, label, icon }: PlatformNavItem) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/platform" && pathname.startsWith(href + "/"));

  return (
    <Link
      href={href}
      className={[
        "group flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
        active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      {icon ? <span className="w-5 text-center">{icon}</span> : null}
      <span className="font-medium">{label}</span>
    </Link>
  );
}

export default function PlatformShell(props: {
  title: string;
  roleLabel: string;
  nav: PlatformNavItem[];
  children: React.ReactNode;
}) {
  const { title, roleLabel, nav, children } = props;
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-transparent">
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 bg-slate-100/95 backdrop-blur shadow-sm">
        <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-4 text-slate-900">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Otvori izbornik"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>

            <div className="min-w-0 flex items-center gap-2">
              <div className="truncate text-sm font-semibold">{title}</div>
              <span className="badge badge-neutral badge-tight">{roleLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <NowDateTime className="hidden text-xs text-slate-700 sm:inline" />
            <PlatformLogoutButton
              className="btn btn-outline"
              label="Odjava"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-3 py-6 sm:px-4">
        <div className="flex rounded-3xl bg-white shadow-lg overflow-hidden">
          {/* MOBILE OVERLAY */}
          {open && (
            <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
          )}

          {/* SIDEBAR */}
          <aside
            className={[
              "z-50 w-72 bg-slate-900",
              "fixed left-0 top-0 h-dvh md:relative md:h-auto",
              "transition-transform md:translate-x-0",
              open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            ].join(" ")}
            aria-label="Izbornik"
          >
            <div className="flex h-14 items-center justify-between px-3 md:hidden">
              <div className="text-sm font-semibold text-white">Izbornik</div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
                onClick={() => setOpen(false)}
                aria-label="Zatvori izbornik"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="space-y-1 px-2 py-4">
              {nav.map((i) => (
                <NavItem key={i.href} href={i.href} label={i.label} icon={i.icon} />
              ))}
            </nav>
          </aside>

          {/* CONTENT */}
          <div className="min-w-0 flex-1 bg-slate-50">
            <div className="px-4 py-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

