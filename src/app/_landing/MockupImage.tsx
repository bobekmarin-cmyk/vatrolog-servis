"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  src: string;
  alt: string;
  /** Stvarna sirina PNG-a (u px). Koristi se za next/image i za lightbox prikaz. */
  width: number;
  /** Stvarna visina PNG-a (u px). */
  height: number;
  /** Tekst ispod mockupa (caption). */
  caption?: string;
  /** LCP optimizacija za hero. */
  priority?: boolean;
  className?: string;
  /** Tailwind sizes prop za responsive image. */
  sizes?: string;
};

/**
 * Prikazuje PNG mockup u landingu. Klik otvara fullscreen lightbox
 * u kojem se mockup prikazuje u nativnoj velicini (scroll + pinch-to-zoom na mobilnom).
 */
export default function MockupImage({
  src,
  alt,
  width,
  height,
  caption,
  priority,
  className = "",
  sizes = "(min-width: 1024px) 50vw, 100vw",
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt} – otvori uvecan prikaz`}
        className="block w-full cursor-zoom-in overflow-hidden rounded-2xl shadow-xl shadow-slate-900/30 ring-1 ring-slate-900/10 transition hover:shadow-2xl"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className="block h-auto w-full"
        />
      </button>
      {caption && (
        <p className="mt-3 text-center text-sm font-medium text-slate-200">{caption}</p>
      )}
      {open && (
        <Lightbox src={src} alt={alt} width={width} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function Lightbox({
  src,
  alt,
  width,
  onClose,
}: {
  src: string;
  alt: string;
  width: number;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[200] flex flex-col bg-slate-950/95 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 text-white">
        <span className="truncate text-sm font-medium text-white/80">{alt}</span>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-white/50 sm:block">Esc za zatvaranje</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori"
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div
        onClick={onClose}
        className="flex-1 overflow-auto"
        style={{ touchAction: "pinch-zoom pan-x pan-y" }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto inline-block min-w-full p-4 sm:p-6"
        >
          {/* Native <img> da bi pinch-zoom radio nativno na mobilnom + da nije ograniceno
              next/image transformacijama. Sirina = nativna CSS sirina (file px / 2 jer
              je capture sniman s deviceScaleFactor=2). Mali ekrani scroll-aju po potrebi. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="block h-auto max-w-none"
            style={{ width: `${width / 2}px` }}
          />
        </div>
      </div>
    </div>
  );
}
