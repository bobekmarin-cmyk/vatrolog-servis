"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import NowDateTime from "@/components/NowDateTime";
import ServicerActivationDropdown from "@/components/ServicerActivationDropdown";
import VatroLogLogo from "@/components/VatroLogLogo";
import { APP_NAME, APP_VERSION } from "@/lib/appVersion";

export type CompanyNavItem = {
  href: string;
  label: string;
  icon?: string;
  /** Ako je zadano, stavka je aktivna kad pathname odgovara nekom od prefiksa (npr. skladište dijelova + manufacturer + primke). */
  activePathPrefixes?: string[];
};

export type CompanyNavSection = {
  title?: string;
  items: CompanyNavItem[];
  /** Prikaz kao neaktivna / uskoro (zasivljeno, bez navigacije). */
  inactiveSection?: boolean;
};

function isItemActive(pathname: string, item: CompanyNavItem): boolean {
  if (item.activePathPrefixes?.length) {
    return item.activePathPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  const { href } = item;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem(item: CompanyNavItem & { disabled?: boolean }) {
  const { href, label, icon, disabled } = item;
  const pathname = usePathname();
  const active = !disabled && isItemActive(pathname, item);

  if (disabled) {
    return (
      <span
        className="flex cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/35"
        title="Modul prodaje još nije aktivan — uskoro."
        aria-disabled="true"
      >
        {icon ? <span className="w-5 text-center opacity-50">{icon}</span> : null}
        <span className="font-medium">{label}</span>
      </span>
    );
  }

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

function SectionHeader({ title, isActive, muted }: { title: string; isActive: boolean; muted?: boolean }) {
  return (
    <div
      className={[
        "px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider",
        muted ? "text-white/25" : isActive ? "text-white/70" : "text-white/40",
      ].join(" ")}
    >
      {title}
    </div>
  );
}

export default function CompanyShell(props: {
  companyName: string;
  roleLabel: string;
  sections: CompanyNavSection[];
  topBarExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { companyName, roleLabel, sections, topBarExtra, children } = props;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-transparent">
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 bg-slate-100/95 backdrop-blur shadow-sm">
        <div className="relative mx-auto flex h-14 max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-4 text-slate-900">
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
              <div className="truncate text-sm font-semibold">{companyName}</div>
              <span className="badge badge-neutral badge-tight">{roleLabel}</span>
            </div>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <VatroLogLogo size="sm" />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <NowDateTime className="hidden text-xs text-slate-500 sm:inline" />
            {topBarExtra}
            <ServicerActivationDropdown />
            <LogoutButton
              className="btn btn-outline"
              label="Odjava"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-3 py-6 sm:px-4">
        <div className="flex items-start gap-0">
          {/* MOBILE OVERLAY */}
          {open && (
            <div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* SIDEBAR */}
          <aside
            className={[
              "z-50 w-72 bg-slate-900 shadow-lg",
              "fixed left-0 top-0 h-dvh",
              "transition-transform",
              open ? "translate-x-0" : "-translate-x-full",
              "md:sticky md:left-auto md:top-20 md:z-auto md:h-auto md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto md:translate-x-0 md:rounded-3xl",
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

            <nav className="space-y-2 px-2 py-4">
              {sections.map((section, idx) => {
                if (section.items.length === 0) return null;
                const sectionActive =
                  !section.inactiveSection && section.items.some((i) => isItemActive(pathname, i));
                return (
                  <div
                    key={idx}
                    className={section.inactiveSection ? "rounded-xl opacity-[0.52]" : undefined}
                  >
                    {section.title ? (
                      <SectionHeader
                        title={section.title}
                        isActive={sectionActive}
                        muted={section.inactiveSection}
                      />
                    ) : null}
                    <div className="space-y-1">
                      {section.items.map((i) => (
                        <NavItem key={i.href} {...i} disabled={section.inactiveSection} />
                      ))}
                    </div>
                    {idx !== sections.length - 1 && <div className="my-3 h-px bg-white/10" />}
                  </div>
                );
              })}
            </nav>

            {/* Sidebar footer s app verzijom */}
            <div className="px-4 pb-4 pt-2 text-[10px] text-white/40">
              {APP_NAME} v{APP_VERSION}
            </div>
          </aside>

          {/* CONTENT */}
          <div className="min-w-0 flex-1 rounded-3xl bg-slate-50 shadow-lg md:ml-4">
            <div className="px-4 py-6">{children}</div>
          </div>
        </div>

        {/* Global app footer sa legal linkovima */}
        <footer className="mt-4 px-2 text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {APP_NAME} v{APP_VERSION}
            </div>
            <nav className="flex flex-wrap gap-3">
              <Link href="/admin/privacy" className="hover:text-slate-800">
                Privatnost i GDPR
              </Link>
              <Link href="/legal/terms" className="hover:text-slate-800">
                Uvjeti
              </Link>
              <Link href="/legal/privacy" className="hover:text-slate-800">
                Politika privatnosti
              </Link>
              <Link href="/legal/dpa" className="hover:text-slate-800">
                DPA
              </Link>
              <Link href="/legal/impressum" className="hover:text-slate-800">
                Impressum
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
