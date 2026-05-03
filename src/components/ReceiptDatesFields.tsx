"use client";

import { useMemo, useState } from "react";
import DatePickerInput from "@/components/DatePickerInput";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDotDate(d: Date) {
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

function normalizeDotDate(value: string): string {
  const d = parseFlexibleDate(value);
  return d ? toDotDate(d) : value;
}

function addDays(value: string, days: number): string {
  const d = parseFlexibleDate(value);
  if (!d || Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return toDotDate(d);
}

export default function ReceiptDatesFields({
  defaultReceivedAt,
  defaultDueAt,
}: {
  defaultReceivedAt: string;
  defaultDueAt?: string;
}) {
  const initialReceivedAt = normalizeDotDate(defaultReceivedAt) || toDotDate(new Date());
  const initialDueAt = (defaultDueAt ?? "").trim() || addDays(initialReceivedAt, 5);

  const [receivedDate, setReceivedDate] = useState(initialReceivedAt);
  const [dueDate, setDueDate] = useState(initialDueAt);
  const [dueTouched, setDueTouched] = useState(Boolean((defaultDueAt ?? "").trim()));

  const dueError = useMemo(() => {
    const r = parseFlexibleDate(receivedDate);
    const d = parseFlexibleDate(dueDate);
    if (!r || !d) return null;
    const rDay = new Date(r.getFullYear(), r.getMonth(), r.getDate()).getTime();
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (dDay < rDay) return "Datum završetka ne može biti prije datuma primitka.";
    return null;
  }, [receivedDate, dueDate]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="label">Datum primitka</label>
        <DatePickerInput
          name="receivedAt"
          value={receivedDate}
          onChange={(next) => {
            setReceivedDate(next);
            if (!dueTouched) {
              setDueDate(addDays(next, 5));
            }
          }}
          required
        />
      </div>

      <div>
        <label className="label">Željeni datum završetka</label>
        <DatePickerInput
          name="dueAt"
          value={dueDate}
          onChange={(next) => {
            setDueTouched(true);
            setDueDate(next);
          }}
          minDate={receivedDate}
          required
        />
        {dueError ? (
          <p className="mt-1 text-xs text-red-600">{dueError}</p>
        ) : (
          <p className="help">Automatski: +5 dana od primitka (možeš promijeniti).</p>
        )}
      </div>
    </div>
  );
}

