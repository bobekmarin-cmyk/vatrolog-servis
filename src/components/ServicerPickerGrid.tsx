"use client";

import { useState } from "react";

export type ServicerPickerEntry = {
  id: string;
  fullName: string;
  /** Je li serviser „upaljen” za današnji rad (aktivacija u ServicerActivationDropdown). */
  activeToday: boolean;
};

type Props = {
  /** Ime polja u FormData (POST servis). */
  name?: string;
  servicers: ServicerPickerEntry[];
  /** Početno odabrani ID samo ako je serviser danas aktivan; u suprotnom ostaje prazno. */
  initialServicerId: string;
  /** Poruka kad je na stavci bio serviser koji danas nije prijavljen. */
  staleServicerHint?: string | null;
  /** Uži gumbi u draweru (2 stupca umjesto 3). */
  compact?: boolean;
};

const INACTIVE_TITLE =
  "Nije prijavljen za rad danas — treba se prijaviti u izborniku „Serviseri”.";

export default function ServicerPickerGrid({
  name = "servicerId",
  servicers,
  initialServicerId,
  staleServicerHint,
  compact = false,
}: Props) {
  const initialOk =
    initialServicerId &&
    servicers.some((s) => s.id === initialServicerId && s.activeToday);
  const [selectedId, setSelectedId] = useState<string>(initialOk ? initialServicerId : "");

  if (servicers.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        U tvrtki nema aktivnih servisera. Dodajte servisere u Administracija → Postavke → Serviseri.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selectedId} aria-hidden="true" />
      <div
        className={compact ? "grid grid-cols-2 gap-1.5" : "grid grid-cols-3 gap-2"}
        role="group"
        aria-label="Odabir servisera"
      >
        {servicers.map((s) => {
          const selected = selectedId === s.id;
          const clickable = s.activeToday;
          const button = (
            <button
              type="button"
              disabled={!clickable}
              onClick={() => {
                if (!clickable) return;
                setSelectedId(s.id);
              }}
              className={[
                compact
                  ? "min-h-[2.25rem] w-full rounded-lg border px-1.5 py-1.5 text-center text-xs font-medium transition-colors"
                  : "min-h-[2.5rem] w-full rounded-lg border px-2 py-2 text-center text-sm font-medium transition-colors",
                !clickable
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : selected
                    ? "border-red-500 bg-red-50 text-red-900 ring-2 ring-red-300"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
              ].join(" ")}
            >
              <span className="line-clamp-2 break-words">{s.fullName}</span>
            </button>
          );
          return (
            <div key={s.id} title={!clickable ? INACTIVE_TITLE : undefined}>
              {button}
            </div>
          );
        })}
      </div>
      {staleServicerHint ? (
        <p className="text-xs text-slate-600">{staleServicerHint}</p>
      ) : null}
    </div>
  );
}
