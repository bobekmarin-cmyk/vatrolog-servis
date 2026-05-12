"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VatroLogLogo from "@/components/VatroLogLogo";

const navLinks = [
  { href: "#znacajke", label: "Značajke" },
  { href: "#kako-radi", label: "Kako radi" },
  { href: "#cijene", label: "Cijene" },
  { href: "#faq", label: "FAQ" },
  { href: "#kontakt", label: "Kontakt" },
];

export default function LandingNav({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const [open, setOpen] = useState(false);

  // Close mobile menu on viewport resize to desktop.
  useEffect(() => {
    if (!open) return;
    function onResize() {
      if (window.innerWidth >= 768) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <a href="#top" className="flex items-center gap-2" aria-label="VatroLog početna">
          <VatroLogLogo size="md" />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="hidden items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-red-600/20 ring-1 ring-red-500/40 hover:bg-red-500 sm:inline-flex"
            >
              Otvori aplikaciju
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-flex"
              >
                Prijava
              </Link>
              <Link
                href="/register"
                className="hidden items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-red-600/20 ring-1 ring-red-500/40 hover:bg-red-500 sm:inline-flex"
              >
                Zatraži probni pristup
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            aria-label={open ? "Zatvori izbornik" : "Otvori izbornik"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:hidden"
          >
            <span aria-hidden className="sr-only">
              Izbornik
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              {open ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div
          id="landing-mobile-menu"
          className="border-t border-slate-200 bg-white md:hidden"
        >
          <ul className="space-y-1 px-4 py-3">
            {navLinks.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {l.label}
                </a>
              </li>
            ))}
            {isAuthenticated ? (
              <li className="pt-2">
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm shadow-red-600/20 ring-1 ring-red-500/40 hover:bg-red-500"
                >
                  Otvori aplikaciju
                </Link>
              </li>
            ) : (
              <>
                <li className="pt-2">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Prijava
                  </Link>
                </li>
                <li>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm shadow-red-600/20 ring-1 ring-red-500/40 hover:bg-red-500"
                  >
                    Zatraži probni pristup
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}
