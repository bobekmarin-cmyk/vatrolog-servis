"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalVariant = "info" | "error" | "warning" | "success" | "danger" | "neutral";

type Props = {
  open: boolean;
  title?: string;
  variant?: ModalVariant;
  icon?: string;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

function headerClasses(variant: ModalVariant): string {
  switch (variant) {
    case "error":
    case "danger":
      return "bg-rose-600 text-white";
    case "warning":
      return "bg-amber-500 text-white";
    case "success":
      return "bg-emerald-600 text-white";
    case "info":
      return "bg-sky-600 text-white";
    case "neutral":
    default:
      return "bg-slate-100 text-slate-900 border-b border-slate-200";
  }
}

function defaultIcon(variant: ModalVariant): string {
  switch (variant) {
    case "error":
    case "danger":
      return "⚠";
    case "warning":
      return "⚠";
    case "success":
      return "✓";
    case "info":
      return "ℹ";
    default:
      return "";
  }
}

function sizeClasses(size: NonNullable<Props["size"]>): string {
  switch (size) {
    case "sm":
      return "max-w-sm";
    case "lg":
      return "max-w-lg";
    case "xl":
      return "max-w-5xl";
    case "md":
    default:
      return "max-w-md";
  }
}

export default function Modal({
  open,
  title,
  variant = "neutral",
  icon,
  onClose,
  closeOnBackdrop = true,
  closeOnEsc = true,
  size = "md",
  header,
  children,
  footer,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && closeOnEsc) onClose?.();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeOnEsc, onClose]);

  if (!open || !mounted) return null;

  const resolvedIcon = icon ?? defaultIcon(variant);

  const dialog = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (closeOnBackdrop) onClose?.();
      }}
    >
      <div
        className={`w-full ${sizeClasses(size)} rounded-xl bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {header ?? (title ? (
          <div className={`flex items-center gap-2 rounded-t-xl px-5 py-3 text-base font-bold ${headerClasses(variant)}`}>
            {resolvedIcon ? <span aria-hidden="true">{resolvedIcon}</span> : null}
            <span className="min-w-0 flex-1 truncate">{title}</span>
          </div>
        ) : null)}

        <div className="space-y-3 px-5 py-4 text-sm text-slate-800">{children}</div>

        {footer ? (
          <div className="flex justify-end gap-2 rounded-b-xl border-t border-black/10 bg-slate-50 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
