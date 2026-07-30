"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import NowDateTime from "@/components/NowDateTime";
import ServicerActivationDropdown from "@/components/ServicerActivationDropdown";
import VatroLogLogo from "@/components/VatroLogLogo";
import { useShellLayout } from "@/components/ShellLayoutContext";
import { APP_NAME, APP_VERSION } from "@/lib/appVersion";

export type CompanyNavItem = {
  href: string;
  label: string;
  icon?: string;
  /** Ako je zadano, stavka je aktivna kad pathname odgovara nekom od prefiksa (npr. skladište dijelova + manufacturer + primke). */
  activePathPrefixes?: string[];
  /** Crveni broj uz stavku (npr. broj nepročitanih obavijesti). 0 / undefined => bez badgea. */
  badgeCount?: number;
};

export type CompanyNavSection = {
  title?: string;
  items: CompanyNavItem[];
  /** Prikaz kao neaktivna / uskoro (zasivljeno, bez navigacije). */
  inactiveSection?: boolean;
  /** Stavke su skrivene dok korisnik ne klikne naslov sekcije (npr. Izvještaji, Admin). */
  collapsible?: boolean;
};

/** Širina privremeno proširenog izbornika koji prelazi preko sadržaja (= w-72). */
const RAIL_OVERLAY_WIDTH = "18rem";

function isItemActive(pathname: string, item: CompanyNavItem): boolean {
  if (item.activePathPrefixes?.length) {
    return item.activePathPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  const { href } = item;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavBadge({ count }: { count: number }) {
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums"
      aria-label={`${count} nepročitanih`}
    >
      {label}
    </span>
  );
}

function RailBadge({ count }: { count: number }) {
  const label = count > 9 ? "9+" : String(count);
  return (
    <span
      className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 py-0.5 text-[9px] font-bold leading-none text-white tabular-nums"
      aria-label={`${count} nepročitanih`}
    >
      {label}
    </span>
  );
}

function NavItem(item: CompanyNavItem & { disabled?: boolean }) {
  const { href, label, icon, disabled, badgeCount } = item;
  const pathname = usePathname();
  const active = !disabled && isItemActive(pathname, item);
  const showBadge = !disabled && typeof badgeCount === "number" && badgeCount > 0;

  if (disabled) {
    return (
      <span
        className="flex cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/55"
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
      // Sidebar je uvijek u vidnom polju, pa bi Next prefetchao SVE stavke na
      // svakom otvaranju stranice — a svaki prefetch je pun server render s
      // vlastitim upitima. To je bio najveci izvor suvisnog opterecenja.
      prefetch={false}
      className={[
        "group flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
        active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      {icon ? <span className="w-5 text-center">{icon}</span> : null}
      <span className="font-medium">{label}</span>
      {showBadge ? <NavBadge count={badgeCount as number} /> : null}
    </Link>
  );
}

function RailNavItem(item: CompanyNavItem & { disabled?: boolean }) {
  const { href, label, icon, disabled, badgeCount } = item;
  const pathname = usePathname();
  const active = !disabled && isItemActive(pathname, item);
  const showBadge = !disabled && typeof badgeCount === "number" && badgeCount > 0;

  const inner = (
    <>
      <span aria-hidden className="text-base leading-none">
        {icon ?? label.slice(0, 1)}
      </span>
      {showBadge ? <RailBadge count={badgeCount as number} /> : null}
    </>
  );

  if (disabled) {
    return (
      <span
        className="relative flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-xl text-white/40"
        title={`${label} — uskoro`}
        aria-disabled="true"
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      className={[
        "relative flex h-10 w-10 items-center justify-center rounded-xl",
        active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
      ].join(" ")}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      {inner}
    </Link>
  );
}

function SectionHeader({
  title,
  isActive,
  muted,
  collapsible,
  expanded,
  onToggle,
}: {
  title: string;
  isActive: boolean;
  muted?: boolean;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const cls = [
    "px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider",
    muted ? "text-white/45" : isActive ? "text-white/85" : "text-white/65",
  ].join(" ");

  if (collapsible && onToggle) {
    return (
      <button
        type="button"
        className={cls + " flex w-full items-center justify-between gap-2 text-left hover:text-white"}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span>{title}</span>
        <span className="text-xs opacity-80" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>
    );
  }

  return <div className={cls}>{title}</div>;
}

function BrandMark() {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-sm font-black text-white"
      aria-hidden
    >
      V
    </span>
  );
}

export default function CompanyShell(props: {
  companyName: string;
  roleLabel: string;
  sections: CompanyNavSection[];
  topBarExtra?: React.ReactNode;
  activeServicerCount?: number;
  children: React.ReactNode;
}) {
  const { companyName, roleLabel, sections, topBarExtra, activeServicerCount, children } = props;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [manualSectionOpen, setManualSectionOpen] = useState<Record<string, boolean | undefined>>({});

  const { contentDrawerOpen } = useShellLayout();
  const [railHovered, setRailHovered] = useState(false);
  const [railPinned, setRailPinned] = useState(false);

  // Svaki novi drawer kreće od skupljene trake (hover/pin se ne pamte).
  const [lastDrawerOpen, setLastDrawerOpen] = useState(contentDrawerOpen);
  if (lastDrawerOpen !== contentDrawerOpen) {
    setLastDrawerOpen(contentDrawerOpen);
    setRailHovered(false);
    setRailPinned(false);
  }

  const railMode = contentDrawerOpen;
  const railExpanded = railMode && (railHovered || railPinned);

  function renderSections(collapsed: boolean) {
    return sections.map((section, idx) => {
      if (section.items.length === 0) return null;
      const sectionActive =
        !section.inactiveSection && section.items.some((i) => isItemActive(pathname, i));
      const sectionKey = section.title ?? `nav-${idx}`;
      const hasActiveInSection = section.items.some((i) => isItemActive(pathname, i));
      const expanded = hasActiveInSection
        ? true
        : manualSectionOpen[sectionKey] !== undefined
          ? (manualSectionOpen[sectionKey] as boolean)
          : !section.collapsible;

      if (collapsed) {
        return (
          <div key={idx} className={section.inactiveSection ? "opacity-[0.52]" : undefined}>
            <div className="flex flex-col items-center gap-1">
              {section.items.map((i) => (
                <RailNavItem key={i.href} {...i} disabled={section.inactiveSection} />
              ))}
            </div>
            {idx !== sections.length - 1 && <div className="mx-auto my-2 h-px w-6 bg-white/15" />}
          </div>
        );
      }

      return (
        <div key={idx} className={section.inactiveSection ? "rounded-xl opacity-[0.52]" : undefined}>
          {section.title ? (
            <SectionHeader
              title={section.title}
              isActive={sectionActive}
              muted={section.inactiveSection}
              collapsible={section.collapsible}
              expanded={section.collapsible ? expanded : undefined}
              onToggle={
                section.collapsible
                  ? () => {
                      setManualSectionOpen((prev) => ({
                        ...prev,
                        [sectionKey]: !expanded,
                      }));
                    }
                  : undefined
              }
            />
          ) : null}
          {section.collapsible && !expanded ? null : (
            <div className="space-y-1">
              {section.items.map((i) => (
                <NavItem key={i.href} {...i} disabled={section.inactiveSection} />
              ))}
            </div>
          )}
          {idx !== sections.length - 1 && <div className="my-3 h-px bg-white/10" />}
        </div>
      );
    });
  }

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
            <NowDateTime className="hidden text-xs text-slate-700 sm:inline" />
            {topBarExtra}
            <ServicerActivationDropdown initialActiveCount={activeServicerCount ?? 0} />
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
              "md:sticky md:left-auto md:top-20 md:h-auto md:translate-x-0 md:rounded-3xl",
              "md:transition-[width] md:duration-200 md:ease-out",
              // Iznad backdropa drawera da izbornik ostane upotrebljiv dok je drawer otvoren.
              railMode
                ? "md:z-[9999] md:w-[4.25rem] md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none"
                : "md:z-auto md:w-72 md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto",
            ].join(" ")}
            aria-label="Izbornik"
            onMouseEnter={railMode ? () => setRailHovered(true) : undefined}
            onMouseLeave={railMode ? () => setRailHovered(false) : undefined}
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

            {/* MOBITEL + normalni desktop izbornik */}
            <nav className={["space-y-2 px-2 py-4", railMode ? "md:hidden" : ""].join(" ")}>
              {renderSections(false)}
            </nav>

            {/* DESKTOP TRAKA S IKONAMA (dok je drawer otvoren) */}
            {railMode ? (
              <div className="hidden md:block">
                <div
                  className={[
                    "flex flex-col items-center gap-1 rounded-3xl bg-slate-900 px-2 py-4 shadow-lg",
                    "transition-opacity duration-150",
                    railExpanded ? "opacity-0" : "opacity-100",
                  ].join(" ")}
                >
                  <div className="mb-2">
                    <BrandMark />
                  </div>
                  {renderSections(true)}
                </div>

                {/* Privremeno prošireni izbornik preko sadržaja */}
                <div
                  className={[
                    "absolute left-0 top-0 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-3xl bg-slate-900 shadow-2xl",
                    "transition-opacity duration-150",
                    railExpanded
                      ? "pointer-events-auto opacity-100"
                      : "pointer-events-none opacity-0",
                  ].join(" ")}
                  style={{ width: RAIL_OVERLAY_WIDTH }}
                  aria-hidden={!railExpanded}
                >
                  <div className="flex items-center justify-between gap-2 px-4 pt-4">
                    <div className="flex items-center gap-2">
                      <BrandMark />
                      <span className="text-sm font-semibold text-white">Izbornik</span>
                    </div>
                    <button
                      type="button"
                      className={[
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs",
                        railPinned
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
                      onClick={() => setRailPinned((v) => !v)}
                      title={railPinned ? "Otkvači izbornik" : "Prikvači izbornik"}
                      aria-label={railPinned ? "Otkvači izbornik" : "Prikvači izbornik"}
                      aria-pressed={railPinned}
                    >
                      <span aria-hidden>📌</span>
                    </button>
                  </div>
                  <nav className="space-y-2 px-2 py-4">{renderSections(false)}</nav>
                </div>
              </div>
            ) : null}
          </aside>

          {/* CONTENT */}
          <div className="min-w-0 flex-1 rounded-3xl bg-slate-100 shadow-lg md:ml-4">
            <div className="px-4 py-6">{children}</div>
          </div>
        </div>

        {/* Global app footer sa legal linkovima */}
        <footer className="mt-4 px-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {APP_NAME} v{APP_VERSION}
            </div>
            {/* prefetch={false}: legal stranice se otvaraju rijetko, a u footeru
                su na svakoj stranici — bez ovoga se prefetchaju stalno. */}
            <nav className="flex flex-wrap gap-3">
              <Link href="/admin/privacy" prefetch={false} className="hover:text-slate-900">
                Privatnost i GDPR
              </Link>
              <Link href="/legal/terms" prefetch={false} className="hover:text-slate-900">
                Uvjeti
              </Link>
              <Link href="/legal/privacy" prefetch={false} className="hover:text-slate-900">
                Politika privatnosti
              </Link>
              <Link href="/legal/dpa" prefetch={false} className="hover:text-slate-900">
                DPA
              </Link>
              <Link href="/legal/impressum" prefetch={false} className="hover:text-slate-900">
                Impressum
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
