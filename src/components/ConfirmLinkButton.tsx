"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function ConfirmLinkButton({
  href,
  title,
  ariaLabel,
  confirmText,
  confirmTitle,
  confirmLabel,
  danger = true,
  disabled,
  children,
}: {
  href: string;
  title: string;
  ariaLabel: string;
  confirmText: string;
  confirmTitle?: string;
  confirmLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);

  function onClick() {
    if (disabled) return;
    setOpen(true);
  }

  function onConfirm() {
    if (navigating) return;
    setNavigating(true);
    router.push(href);
  }

  return (
    <>
      {navigating ? (
        <LoadingOverlay
          title="Otvaram servis..."
          message="Molimo pričekajte, otvara se stranica za servisiranje aparata."
        />
      ) : null}
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        className={[
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border",
          disabled
            ? "cursor-not-allowed border-gray-200 text-gray-300"
            : "border-gray-200 text-gray-700 hover:bg-gray-50",
        ].join(" ")}
        onClick={onClick}
      >
        {children}
      </button>

      <Modal
        open={open}
        title={confirmTitle ?? "Potvrda"}
        variant={danger ? "danger" : "neutral"}
        onClose={navigating ? undefined : () => setOpen(false)}
        closeOnBackdrop={!navigating}
        closeOnEsc={!navigating}
        footer={
          <>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              onClick={() => setOpen(false)}
              disabled={navigating}
            >
              Odustani
            </button>
            <button
              type="button"
              autoFocus
              className={
                danger
                  ? "rounded-md bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-70"
                  : "rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
              }
              onClick={onConfirm}
              disabled={navigating}
            >
              {navigating ? "Otvaram servis..." : (confirmLabel ?? "Potvrdi")}
            </button>
          </>
        }
      >
        <div>{confirmText}</div>
      </Modal>
    </>
  );
}
