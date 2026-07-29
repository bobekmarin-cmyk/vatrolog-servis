"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";

export default function PlaceholderAddForm({
  orderId,
}: {
  orderId: string;
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [count, setCount] = useState(1);
  const [saving, setSaving] = useState(false);
  // Refresh tablice traje i nakon POST-a — gumb ostaje u „Dodajem…” do kraja.
  const [refreshing, startRefresh] = useTransition();
  const busy = saving || refreshing;
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setSafe(value: number) {
    setCount(Math.max(1, Math.min(200, Math.floor(Number.isFinite(value) ? value : 1))));
  }

  function clearHold() {
    if (holdTimeoutRef.current) { clearTimeout(holdTimeoutRef.current); holdTimeoutRef.current = null; }
    if (holdIntervalRef.current) { clearInterval(holdIntervalRef.current); holdIntervalRef.current = null; }
  }

  function startHold(delta: number) {
    setSafe(count + delta);
    clearHold();
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        setCount((prev) => Math.max(1, Math.min(200, prev + delta)));
      }, 70);
    }, 250);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || count < 1) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/work-orders/${orderId}/items/add-placeholders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
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

  return (
    <form className="flex flex-col items-center justify-center gap-2 h-full" onSubmit={handleSubmit}>
      <label className="label">Placeholder</label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-outline h-9 w-9 p-0 text-lg leading-none"
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
          name="count"
          className="input h-9 w-16 text-center font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          min={1}
          max={200}
          value={count}
          onChange={(e) => setSafe(Number(e.target.value))}
        />
        <button
          type="button"
          className="btn btn-primary h-9 w-9 p-0 text-lg leading-none"
          onMouseDown={() => startHold(1)}
          onMouseUp={clearHold}
          onMouseLeave={clearHold}
          onTouchStart={() => startHold(1)}
          onTouchEnd={clearHold}
        >
          +
        </button>
        <button className="btn btn-primary h-9 px-4 ml-1" type="submit" disabled={busy}>
          {busy ? "Dodajem..." : "Dodaj"}
        </button>
      </div>
    </form>
  );
}
