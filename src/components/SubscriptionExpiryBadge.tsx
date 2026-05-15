"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";

type Props = {
  daysUntilExpiry: number;
  activeUntilIso: string;
};

function formatDaysHr(days: number): string {
  if (days === 0) return "danas";
  if (days === 1) return "za 1 dan";
  return `za ${days} dana`;
}

export default function SubscriptionExpiryBadge({ daysUntilExpiry, activeUntilIso }: Props) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => typeof document !== "undefined",
    () => false,
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const activeUntil = new Date(activeUntilIso);
  const label =
    daysUntilExpiry === 0
      ? "Pretplata ističe danas"
      : `Pretplata ističe ${formatDaysHr(daysUntilExpiry)}`;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-t-xl bg-rose-600 px-5 py-3 text-white">
          <div className="flex items-center gap-2 text-base font-bold">
            <span aria-hidden="true">⚠</span>
            <span>{label}</span>
          </div>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm text-slate-800">
          <div>
            Datum isteka pretplate:{" "}
            <b className="tabular-nums">{formatDateDdMmYyyy(activeUntil)}</b>
          </div>
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-900">
            Za obnovu pretplate javite se podršci prije isteka. Nakon isteka, pristup programu će
            biti <b> onemogućen</b> dok se pretplata ne obnovi.
          </div>
        </div>
        <div className="flex flex-col justify-end gap-2 rounded-b-xl border-t border-black/10 bg-slate-50 px-5 py-3 sm:flex-row">
          <a
            href="mailto:info@vatrolog.com?subject=Obnova%20VatroLog%20pretplate"
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-center text-sm font-medium text-white hover:bg-indigo-500"
          >
            Zatraži obnovu
          </a>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => setOpen(false)}
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400 whitespace-nowrap"
        aria-label={label}
      >
        <span aria-hidden="true">⚠</span>
        <span>{label}</span>
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
