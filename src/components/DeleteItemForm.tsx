"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";

export default function DeleteItemForm({
  action,
  disabled,
  confirmText = "Obrisati ovu stavku iz naloga?",
  blockedReason,
}: {
  action: string;
  disabled?: boolean;
  confirmText?: string;
  /** Ako je postavljeno, brisanje je zabranjeno i gumb samo objasni zašto. */
  blockedReason?: string;
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [deleting, setDeleting] = useState(false);
  // Redak nestaje tek kad refresh dođe sa servera — dotad gumb ostaje zauzet.
  const [refreshing, startRefresh] = useTransition();
  const busy = deleting || refreshing;

  async function handleClick() {
    if (disabled || busy) return;

    if (blockedReason) {
      await dialog.alert({
        title: "Brisanje nije moguće",
        message: blockedReason,
        variant: "warning",
      });
      return;
    }

    const ok = await dialog.confirm({
      title: "Brisanje stavke",
      message: confirmText,
      danger: true,
      confirmLabel: "Obriši",
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(action, {
        method: "POST",
        headers: { Accept: "application/json" },
        redirect: "manual",
      });
      if (res.ok || res.type === "opaqueredirect") {
        startRefresh(() => router.refresh());
      } else {
        const data = (await res.json().catch(() => null)) as null | { error?: string };
        await dialog.alert({
          title: "Brisanje nije uspjelo",
          message: data?.error ?? "Greška pri brisanju.",
          variant: "error",
        });
      }
    } catch {
      await dialog.alert({
        title: "Brisanje nije uspjelo",
        message: "Greška pri brisanju.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-disabled={disabled || busy}
      title={disabled ? "Zaključano" : blockedReason ?? "Obriši"}
      aria-label="Obriši"
      onClick={handleClick}
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border cursor-pointer",
        disabled || busy
          ? "cursor-not-allowed border-gray-200 text-gray-300"
          : "border-gray-200 text-red-600 hover:bg-red-50",
      ].join(" ")}
    >
      {busy ? (
        <span className="animate-spin text-xs">⏳</span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M6 6l1 16h10l1-16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      )}
    </button>
  );
}
