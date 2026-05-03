"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { hr } from "date-fns/locale";
import "react-day-picker/style.css";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDotDate(d: Date) {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
}

function parseFlexibleDate(value: string): Date | null {
  const v = String(value ?? "").trim();
  const dot = /^(\d{2})\.(\d{2})\.(\d{4})\.?$/.exec(v);
  if (dot) {
    const dd = Number(dot[1]);
    const mm = Number(dot[2]) - 1;
    const yyyy = Number(dot[3]);
    const out = new Date(yyyy, mm, dd, 12, 0, 0, 0);
    return Number.isNaN(out.getTime()) ? null : out;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) {
    const yyyy = Number(iso[1]);
    const mm = Number(iso[2]) - 1;
    const dd = Number(iso[3]);
    const out = new Date(yyyy, mm, dd, 12, 0, 0, 0);
    return Number.isNaN(out.getTime()) ? null : out;
  }
  return null;
}

export default function DatePickerInput({
  name,
  value,
  onChange,
  required,
  className = "input",
  placeholder = "dd.mm.gggg.",
  minDate,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
  minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const selected = useMemo(() => parseFlexibleDate(value), [value]);

  const disabledBefore = useMemo(() => {
    if (!minDate) return undefined;
    const d = parseFlexibleDate(minDate);
    if (!d) return undefined;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, [minDate]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }

    function handleScroll() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  return (
    <div ref={triggerRef} className="relative">
      <input
        type="text"
        name={name}
        className={`${className} pr-11`}
        value={value}
        inputMode="numeric"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const parsed = parseFlexibleDate(e.target.value);
          if (parsed) onChange(formatDotDate(parsed));
        }}
        required={required}
        autoComplete="off"
      />
      <button
        type="button"
        className="absolute inset-y-0 right-2 inline-flex items-center text-slate-500"
        aria-label="Odaberi datum"
        title="Odaberi datum"
        onClick={() => setOpen((prev) => !prev)}
      >
        📅
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[9999] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
            style={{ top: pos.top, left: pos.left, position: "absolute" }}
          >
            <DayPicker
              mode="single"
              locale={hr}
              weekStartsOn={1}
              selected={selected ?? undefined}
              defaultMonth={selected ?? new Date()}
              disabled={disabledBefore ? { before: disabledBefore } : undefined}
              onSelect={(day) => {
                if (day) {
                  onChange(formatDotDate(day));
                }
                setOpen(false);
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
