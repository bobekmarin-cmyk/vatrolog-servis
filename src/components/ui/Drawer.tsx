"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  'input:not([type="hidden"]):not([disabled])',
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const ANIMATION_MS = 200;

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** CSS širina panela; default ~480px, ali nikad šire od ekrana. */
  width?: string;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  /** Element koji dobiva fokus kad se drawer otvori. */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "min(480px, 100vw)",
  closeOnBackdrop = true,
  closeOnEsc = true,
  initialFocusRef,
}: Props) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => typeof document !== "undefined",
    () => false,
  );

  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // `closing` drži panel u DOM-u dok traje izlazna animacija, `shown` vodi transition.
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const hasOpenedRef = useRef(false);
  const render = open || closing;

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    if (!hasOpenedRef.current) return;
    queueMicrotask(() => {
      setShown(false);
      setClosing(true);
    });
    const timer = setTimeout(() => setClosing(false), ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!render) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [render]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      const target =
        initialFocusRef?.current ??
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        panelRef.current;
      target?.focus();
      if (target instanceof HTMLInputElement) target.select();
    }, ANIMATION_MS / 2);
    return () => {
      clearTimeout(timer);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, initialFocusRef]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && closeOnEsc) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [closeOnEsc, onClose],
  );

  if (!render || !mounted) return null;

  const drawer = (
    <div className="fixed inset-0 z-[9998]" role="presentation">
      <div
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-200 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => {
          if (closeOnBackdrop) onClose();
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{ width }}
        className={`absolute inset-y-0 right-0 flex max-w-full flex-col bg-white shadow-2xl outline-none transition-transform duration-200 ease-out ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            title="Zatvori"
            aria-label="Zatvori"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-800">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
