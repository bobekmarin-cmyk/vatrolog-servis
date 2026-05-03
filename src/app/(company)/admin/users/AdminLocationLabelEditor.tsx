"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  locationId: string;
  currentLabel: string;
};

const MAX_LEN = 60;

export default function AdminLocationLabelEditor({ locationId, currentLabel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentLabel);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function startEdit() {
    setValue(currentLabel);
    setErr(null);
    setOpen(true);
  }

  function cancel() {
    setOpen(false);
    setErr(null);
    setValue(currentLabel);
  }

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setErr("Labela je obavezna.");
      return;
    }
    if (trimmed === currentLabel) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/locations/${encodeURIComponent(locationId)}/rename`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ label: trimmed }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "Greška pri spremanju.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setErr("Greška pri spremanju.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={startEdit}
        title={`${currentLabel} — klikni za promjenu labele`}
        className="group inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
      >
        <span className="max-w-[12rem] truncate">{currentLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="h-3 w-3 text-slate-400 opacity-0 transition group-hover:opacity-100"
        >
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-9.9 9.9a2 2 0 01-.878.506l-3.535 1.06a.5.5 0 01-.62-.62l1.06-3.535a2 2 0 01.506-.878l9.9-9.9z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        className="input h-7 w-44 text-xs"
        value={value}
        maxLength={MAX_LEN}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        disabled={busy}
      />
      <button
        type="button"
        className="btn btn-primary h-7 px-2 text-xs"
        onClick={save}
        disabled={busy}
        title="Spremi (Enter)"
      >
        {busy ? "…" : "Spremi"}
      </button>
      <button
        type="button"
        className="btn btn-outline h-7 px-2 text-xs"
        onClick={cancel}
        disabled={busy}
        title="Odustani (Esc)"
      >
        ✕
      </button>
      {err ? <span className="text-[11px] text-rose-600">{err}</span> : null}
    </div>
  );
}
