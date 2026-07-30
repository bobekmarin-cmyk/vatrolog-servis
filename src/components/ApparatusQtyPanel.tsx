"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";
import Modal from "@/components/ui/Modal";
import DatePickerInput from "@/components/DatePickerInput";

type BatchRow = {
  id?: string;
  receivedAt: string;
  receivedAtLabel?: string;
  qty: number;
  isInitial: boolean;
};

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDot(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}.`;
}

function dotToIso(dot: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})\.?$/.exec(dot.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const valueRef = useRef(value);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  function setSafe(n: number) {
    onChange(Math.max(min, Math.min(max, Math.floor(Number.isFinite(n) ? n : min))));
  }

  function clearHold() {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }

  function startHold(delta: number) {
    if (disabled) return;
    setSafe(valueRef.current + delta);
    clearHold();
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        setSafe(valueRef.current + delta);
      }, 70);
    }, 250);
  }

  useEffect(() => () => clearHold(), []);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="btn btn-outline h-8 w-8 p-0 text-base leading-none"
        disabled={disabled || value <= min}
        onMouseDown={() => startHold(-1)}
        onMouseUp={clearHold}
        onMouseLeave={clearHold}
        onTouchStart={() => startHold(-1)}
        onTouchEnd={clearHold}
      >
        −
      </button>
      <input
        type="number"
        className="input h-8 w-12 text-center text-sm font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => setSafe(Number(e.target.value))}
      />
      <button
        type="button"
        className="btn btn-primary h-8 w-8 p-0 text-base leading-none"
        disabled={disabled || value >= max}
        onMouseDown={() => startHold(1)}
        onMouseUp={clearHold}
        onMouseLeave={clearHold}
        onTouchStart={() => startHold(1)}
        onTouchEnd={clearHold}
      >
        +
      </button>
    </div>
  );
}

export default function ApparatusQtyPanel({
  orderId,
  initialTotalQty,
}: {
  orderId: string;
  initialTotalQty?: number;
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [count, setCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const busy = saving || refreshing;

  const [editOpen, setEditOpen] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [savingBatches, setSavingBatches] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [totalQty, setTotalQty] = useState(initialTotalQty ?? 0);

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetch(`/api/work-orders/${orderId}/receipt-batches`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Greška");
      setItemCount(data.itemCount ?? 0);
      setTotalQty(data.receivedQty ?? 0);
      setRows(
        (data.batches as BatchRow[]).map((b) => ({
          id: b.id,
          receivedAt: b.receivedAt,
          receivedAtLabel: b.receivedAtLabel,
          qty: b.qty,
          isInitial: b.isInitial,
        })),
      );
    } catch (e) {
      await dialog.alert({
        title: "Učitavanje nije uspjelo",
        message: e instanceof Error ? e.message : "Greška",
        variant: "error",
      });
    } finally {
      setLoadingBatches(false);
    }
  }, [orderId, dialog]);

  async function openEditor() {
    setEditOpen(true);
    await loadBatches();
  }

  async function handleAddPlaceholders(e: React.FormEvent) {
    e.preventDefault();
    if (busy || count < 1) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/work-orders/${orderId}/items/add-placeholders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, receivedAt: todayIso() }),
        redirect: "manual",
      });
      if (!res.ok && res.type !== "opaqueredirect") {
        const text = await res.text();
        await dialog.alert({
          title: "Dodavanje nije uspjelo",
          message: text || "Greška pri dodavanju.",
          variant: "error",
        });
        return;
      }
      startRefresh(() => router.refresh());
      setCount(1);
      setTotalQty((t) => t + count);
    } catch {
      await dialog.alert({
        title: "Dodavanje nije uspjelo",
        message: "Greška kod dodavanja.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function updateRow(idx: number, patch: Partial<BatchRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx: number) {
    setRows((prev) => {
      const row = prev[idx];
      if (!row || row.isInitial) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }

  function addRow() {
    setRows((prev) => [...prev, { receivedAt: todayIso(), qty: 1, isInitial: false }]);
  }

  async function saveBatches() {
    setSavingBatches(true);
    try {
      const res = await fetch(`/api/work-orders/${orderId}/receipt-batches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batches: rows.map((r) => ({
            id: r.id,
            receivedAt: r.receivedAt,
            qty: r.qty,
            isInitial: r.isInitial,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await dialog.alert({
          title: "Spremanje nije uspjelo",
          message: data.error || "Greška",
          variant: "error",
        });
        return;
      }
      setTotalQty(data.receivedQty ?? 0);
      setEditOpen(false);
      startRefresh(() => router.refresh());
    } finally {
      setSavingBatches(false);
    }
  }

  const sumQty = rows.reduce((s, r) => s + Math.max(0, r.qty || 0), 0);

  return (
    <>
      <form className="flex w-full flex-col items-center gap-1.5 text-center" onSubmit={handleAddPlaceholders}>
        <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5">
          <div className="text-sm font-semibold text-slate-900">Količina aparata</div>
          {totalQty > 0 ? (
            <div className="text-[11px] tabular-nums text-slate-500">
              Ukupno: <span className="font-semibold text-slate-700">{totalQty}</span> kom
            </div>
          ) : null}
        </div>
        <QtyStepper value={count} onChange={setCount} min={1} max={200} disabled={busy} />
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button className="btn btn-primary h-8 px-3 text-sm" type="submit" disabled={busy}>
            {busy ? "…" : "Dodaj"}
          </button>
          <button
            type="button"
            className="btn btn-outline h-8 px-2.5 text-xs"
            onClick={openEditor}
            disabled={busy}
            title="Uređivanje količine"
          >
            Uredi
          </button>
        </div>
      </form>

      <Modal
        open={editOpen}
        onClose={() => !savingBatches && setEditOpen(false)}
        title="Uređivanje količine aparata"
        variant="neutral"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-outline px-4"
              disabled={savingBatches}
              onClick={() => setEditOpen(false)}
            >
              Odustani
            </button>
            <button
              type="button"
              className="btn btn-primary px-4"
              disabled={savingBatches || loadingBatches || sumQty < itemCount}
              onClick={saveBatches}
            >
              {savingBatches ? "Spremam…" : "Spremi"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            Prvi red je datum otvaranja naloga (ne može se obrisati). Ukupna količina ne smije biti
            manja od broja aparata već unesenih u nalog
            {itemCount > 0 ? (
              <>
                {" "}
                (<span className="font-semibold tabular-nums">{itemCount}</span>)
              </>
            ) : null}
            .
          </p>

          {loadingBatches ? (
            <div className="py-6 text-center text-slate-500">Učitavam…</div>
          ) : (
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div
                  key={row.id ?? `new-${idx}`}
                  className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
                >
                  <div className="min-w-[9.5rem] flex-1">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {row.isInitial ? "Datum otvaranja" : "Datum dostave"}
                    </div>
                    {row.isInitial ? (
                      <div className="input flex h-9 items-center bg-white text-slate-800">
                        {row.receivedAtLabel ?? isoToDot(row.receivedAt)}
                      </div>
                    ) : (
                      <DatePickerInput
                        name={`batch-date-${idx}`}
                        value={isoToDot(row.receivedAt)}
                        onChange={(v) => {
                          const iso = dotToIso(v);
                          if (iso) updateRow(idx, { receivedAt: iso });
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Količina
                    </div>
                    <QtyStepper
                      value={row.qty}
                      min={1}
                      max={999}
                      onChange={(n) => updateRow(idx, { qty: n })}
                    />
                  </div>
                  {!row.isInitial ? (
                    <button
                      type="button"
                      className="btn btn-outline h-9 px-3 text-xs text-red-700"
                      onClick={() => removeRow(idx)}
                    >
                      Obriši
                    </button>
                  ) : (
                    <span className="h-9 px-2 text-[11px] leading-9 text-slate-400">Početni</span>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-outline w-full text-sm" onClick={addRow}>
                + Dodaj datum i količinu
              </button>
              <div className="text-right text-xs text-slate-500">
                Zbroj: <span className="font-semibold tabular-nums text-slate-800">{sumQty}</span> kom
                {sumQty < itemCount ? (
                  <span className="ml-2 text-red-600">— premali u odnosu na unesene aparate</span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
