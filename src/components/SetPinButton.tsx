"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetPinButton({ servicerId, hasPin }: { servicerId: string; hasPin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Optimistički flag: čim API potvrdi OK, gumb odmah piše „Promijeni PIN" (server refresh slijedi).
  const [optimisticHasPin, setOptimisticHasPin] = useState(false);
  const effectiveHasPin = hasPin || optimisticHasPin;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  async function handleSave() {
    if (saving || pin.length !== 4) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/servicers/${servicerId}/set-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "PIN spremljen" });
        setPin("");
        setOptimisticHasPin(true);
        router.refresh();
        setTimeout(() => { setOpen(false); setMsg(null); }, 1200);
      } else {
        const data = await res.json();
        setMsg({ ok: false, text: data.error || "Greška" });
      }
    } catch {
      setMsg({ ok: false, text: "Greška" });
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`text-xs px-2 py-0.5 rounded-md font-medium ${effectiveHasPin ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
        onClick={() => setOpen(true)}
      >
        {effectiveHasPin ? "Promijeni PIN" : "Postavi PIN"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        maxLength={4}
        placeholder="4 znamenke"
        className="input h-7 w-20 text-center text-xs font-mono tracking-widest"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={(e) => { if (e.key === "Enter" && pin.length === 4) handleSave(); }}
      />
      <button
        type="button"
        className="btn btn-primary h-7 px-2 text-xs"
        disabled={pin.length !== 4 || saving}
        onClick={handleSave}
      >
        {saving ? "..." : "Spremi"}
      </button>
      <button
        type="button"
        className="text-xs text-slate-400 hover:text-slate-600"
        onClick={() => { setOpen(false); setPin(""); setMsg(null); }}
      >
        ✕
      </button>
      {msg && <span className={`text-[11px] ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
    </div>
  );
}
