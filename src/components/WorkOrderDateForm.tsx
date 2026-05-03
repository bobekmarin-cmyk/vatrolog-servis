"use client";

import { useState } from "react";
import DatePickerInput from "@/components/DatePickerInput";
import { useDialog } from "@/components/ui/useDialog";

export default function WorkOrderDateForm({
  orderId,
  defaultValue,
  disabled,
  disabledReason,
}: {
  orderId: string;
  defaultValue: string;
  disabled: boolean;
  disabledReason?: string;
}) {
  const dialog = useDialog();
  const [date, setDate] = useState(defaultValue);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("receivedAt", date);
      const res = await fetch(`/api/work-orders/${orderId}/update-date`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        await dialog.alert({
          title: "Spremanje datuma nije uspjelo",
          message: data?.error ?? "Greška kod spremanja datuma.",
          variant: "error",
        });
        return;
      }
      window.location.reload();
    } catch {
      await dialog.alert({
        title: "Spremanje datuma nije uspjelo",
        message: "Greška kod spremanja datuma.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return (
      <div>
        <label className="label">Datum radnog naloga</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-400">{defaultValue}</span>
          <span className="text-amber-500" title={disabledReason}>⚠</span>
        </div>
      </div>
    );
  }

  return (
    <form className="flex items-end gap-2" onSubmit={handleSubmit}>
      <div className="flex-1">
        <label className="label">Datum radnog naloga</label>
        <DatePickerInput
          name="receivedAt"
          value={date}
          onChange={setDate}
          className="input w-full"
          required
        />
      </div>
      <button
        className="btn btn-outline h-10 w-10 p-0 shrink-0"
        type="submit"
        disabled={saving}
        title="Spremi datum"
        aria-label="Spremi datum"
      >
        {saving ? (
          <span className="animate-spin text-sm">⏳</span>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        )}
      </button>
    </form>
  );
}
