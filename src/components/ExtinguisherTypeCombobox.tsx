"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatExtinguisherTypeParts } from "@/lib/formatExtinguisherType";

export type ExtTypeOption = {
  id: string;
  code: string;
  agent?: { code: string; label: string; symbol?: string | null } | null;
  construction?: { code?: string | null; label?: string | null } | null;
};

export default function ExtinguisherTypeCombobox(props: {
  name: string;
  value: string;
  onChange: (id: string) => void;
  options: ExtTypeOption[];
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { name, value, onChange, options, required, disabled, placeholder } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [open]);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const { main, meta } = formatExtinguisherTypeParts(o);
      const full = `${main} ${meta}`.toLowerCase();
      return full.includes(q);
    });
  }, [options, query]);

  const selectedParts = selected ? formatExtinguisherTypeParts(selected) : null;

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />

      <button
        type="button"
        className={[
          "select w-full text-left flex items-center justify-between gap-2",
          disabled ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedParts ? (
          <span className="truncate">
            <span className="font-medium text-slate-900">{selectedParts.main}</span>
            {selectedParts.meta ? (
              <span className="ml-1 text-slate-400">{selectedParts.meta}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-slate-500">{placeholder ?? "-- odaberi --"}</span>
        )}
        <span className="text-slate-400 shrink-0">▾</span>
      </button>

      {open && !disabled && (
        <div
          className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              type="text"
              className="input w-full"
              placeholder="Pretraži…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setOpen(false);
                  return;
                }
                // Enter u pretrazi bira prvi rezultat umjesto da pošalje formu.
                if (e.key === "Enter") {
                  e.preventDefault();
                  const first = filtered[0];
                  if (first) {
                    onChange(first.id);
                    setOpen(false);
                    setQuery("");
                  }
                }
              }}
            />
          </div>
          <ul className="max-h-64 overflow-auto py-1 text-sm">
            <li>
              <button
                type="button"
                className={[
                  "w-full text-left px-3 py-2 hover:bg-slate-50",
                  !value ? "bg-slate-50" : "",
                ].join(" ")}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="text-slate-500">-- odaberi --</span>
              </button>
            </li>
            {filtered.map((o) => {
              const { main, meta } = formatExtinguisherTypeParts(o);
              const active = o.id === value;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={[
                      "w-full text-left px-3 py-2 hover:bg-slate-50",
                      active ? "bg-indigo-50" : "",
                    ].join(" ")}
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="font-medium text-slate-900">{main}</span>
                    {meta ? <span className="ml-1 text-slate-400">{meta}</span> : null}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-slate-500">Nema rezultata.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
