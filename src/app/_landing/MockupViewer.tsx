"use client";

import { useEffect, useRef, useState } from "react";
import BrowserFrame from "./BrowserFrame";

type MockupViewerProps = {
  url?: string;
  nativeWidth?: number;
  caption?: string;
  className?: string;
  children: React.ReactNode;
};

export default function MockupViewer({
  url,
  nativeWidth = 1100,
  caption,
  className = "",
  children,
}: MockupViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / nativeWidth));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [nativeWidth]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => {
      const h = el.scrollHeight;
      if (h > 0) setContentHeight(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
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

  const ready = contentHeight > 0;
  const visualWidth = ready ? nativeWidth * scale : undefined;
  const visualHeight = ready ? contentHeight * scale : undefined;
  const isShrunk = scale < 0.999;

  return (
    <div className={className}>
      <div ref={containerRef} className="relative w-full">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Otvori uvećan prikaz mockupa"
          className="block w-full cursor-zoom-in text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <div
            className="relative mx-auto overflow-hidden"
            style={
              ready
                ? { width: visualWidth, height: visualHeight }
                : { width: "100%" }
            }
          >
            <div
              ref={innerRef}
              style={{
                width: nativeWidth,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <BrowserFrame url={url ?? ""}>{children}</BrowserFrame>
            </div>
          </div>
        </button>

        {isShrunk && (
          <div className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/90 px-3 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-white/20 backdrop-blur sm:bottom-4 sm:right-4">
            <ZoomIcon />
            Otvori veći prikaz
          </div>
        )}
      </div>

      {caption && (
        <p className="mt-3 text-center text-sm font-medium text-slate-200">{caption}</p>
      )}

      {open && (
        <Lightbox onClose={() => setOpen(false)} url={url}>
          {children}
        </Lightbox>
      )}
    </div>
  );
}

function Lightbox({
  children,
  onClose,
  url,
}: {
  children: React.ReactNode;
  onClose: () => void;
  url?: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950/80 px-4 py-3 text-white">
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">
            {url ?? "Uvećan prikaz"}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <CloseIcon />
            Zatvori
          </button>
        </div>
        <div
          className="flex-1 overflow-auto bg-slate-900 p-4"
          style={{ touchAction: "pan-x pan-y pinch-zoom" }}
        >
          <div className="mx-auto" style={{ width: "max-content" }}>
            <BrowserFrame url={url ?? ""}>{children}</BrowserFrame>
          </div>
        </div>
        <p className="bg-slate-950/80 px-4 py-2 text-center text-[11px] text-slate-300 sm:hidden">
          Povucite prstom za pregled · uštipnite za zumiranje
        </p>
      </div>
    </div>
  );
}

function ZoomIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
