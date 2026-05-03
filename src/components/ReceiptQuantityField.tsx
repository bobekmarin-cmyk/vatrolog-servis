"use client";

import { useRef, useState } from "react";

export default function ReceiptQuantityField({
  defaultValue = 1,
  min = 1,
}: {
  defaultValue?: number;
  min?: number;
}) {
  const safeDefault = Number.isFinite(defaultValue) && defaultValue >= min ? Math.floor(defaultValue) : min;
  const [qty, setQty] = useState<number>(safeDefault);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setSafe(value: number) {
    if (!Number.isFinite(value)) {
      setQty(min);
      return;
    }
    setQty(Math.max(min, Math.floor(value)));
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
    setSafe(qty + delta);
    clearHold();
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        setQty((prev) => Math.max(min, prev + delta));
      }, 70);
    }, 250);
  }

  return (
    <div className="w-full">
      <label className="label font-semibold">Količina (kom)</label>
      <div className="mt-1 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
        <button
          type="button"
          className="btn btn-outline h-9 w-9 p-0 text-lg leading-none"
          onMouseDown={() => startHold(-1)}
          onMouseUp={clearHold}
          onMouseLeave={clearHold}
          onTouchStart={() => startHold(-1)}
          onTouchEnd={clearHold}
          title="Smanji količinu"
          aria-label="Smanji količinu"
        >
          −
        </button>
        <input
          type="number"
          name="baseReceivedQty"
          className="input h-11 flex-1 text-center text-2xl font-bold"
          min={min}
          step={1}
          value={qty}
          onChange={(e) => setSafe(Number(e.target.value))}
          required
        />
        <button
          type="button"
          className="btn btn-primary h-9 w-9 p-0 text-lg leading-none"
          onMouseDown={() => startHold(1)}
          onMouseUp={clearHold}
          onMouseLeave={clearHold}
          onTouchStart={() => startHold(1)}
          onTouchEnd={clearHold}
          title="Povećaj količinu"
          aria-label="Povećaj količinu"
        >
          +
        </button>
      </div>
    </div>
  );
}

