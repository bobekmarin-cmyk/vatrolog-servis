"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastVariant = "info" | "success" | "warning" | "error";

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  info: "ℹ",
  success: "✓",
  warning: "⚠",
  error: "✕",
};

const DEFAULT_TIMEOUT_MS = 4500;

/**
 * Lagani toast provider koji se mounta na razini root layout-a.
 * Komponente pozivaju `showToast(...)` iz `useToast` hook-a; toastovi nestaju
 * automatski, a korisnik ih može i ručno zatvoriti.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const handle = timeouts.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timeouts.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((t) => [...t, { id, message, variant }]);
      const handle = setTimeout(() => dismiss(id), DEFAULT_TIMEOUT_MS);
      timeouts.current.set(id, handle);
    },
    [dismiss],
  );

  useEffect(() => {
    const tm = timeouts.current;
    return () => {
      for (const handle of tm.values()) clearTimeout(handle);
      tm.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[1000] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-md ${VARIANT_STYLES[t.variant]}`}
            role={t.variant === "error" ? "alert" : "status"}
          >
            <span aria-hidden className="mt-0.5 text-base font-bold">
              {VARIANT_ICONS[t.variant]}
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="opacity-60 transition hover:opacity-100"
              aria-label="Zatvori obavijest"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook za prikaz toastova iz client komponenata.
 * Ako provider nije mount-an, toast se silently ignorira (ne pucamo runtime).
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  return {
    showToast: (message: string) => {
      if (typeof console !== "undefined") {
        console.warn("[toast missing provider]", message);
      }
    },
  };
}
