"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Servicer = {
  id: string;
  fullName: string;
  activeToday: boolean;
  hasPin: boolean;
};

export default function ServicerActivationDropdown() {
  const [open, setOpen] = useState(false);
  const [servicers, setServicers] = useState<Servicer[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const [activating, setActivating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const fetchServicers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/servicers/status");
      if (res.ok) setServicers(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServicers();
  }, [fetchServicers]);

  useEffect(() => {
    if (open) fetchServicers();
  }, [open, fetchServicers]);

  useEffect(() => {
    if (pinFor && pinInputRef.current) pinInputRef.current.focus();
  }, [pinFor]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPinFor(null);
        setPinValue("");
        setPinError("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const activeCount = servicers.filter((s) => s.activeToday).length;

  async function handleActivate(id: string) {
    if (activating) return;
    setPinError("");
    setActivating(true);
    try {
      const res = await fetch("/api/servicers/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicerId: id, pin: pinValue }),
      });
      if (res.ok) {
        setPinFor(null);
        setPinValue("");
        await fetchServicers();
      } else {
        const data = await res.json();
        setPinError(data.error || "Greška");
      }
    } catch {
      setPinError("Greška pri aktivaciji.");
    }
    setActivating(false);
  }

  async function handleDeactivate(id: string) {
    try {
      const res = await fetch("/api/servicers/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicerId: id }),
      });
      if (res.ok) await fetchServicers();
    } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="btn btn-outline px-2.5 py-1.5 text-xs gap-1.5"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${activeCount > 0 ? "bg-emerald-500" : "bg-red-500"}`} />
          Serviseri
          {activeCount > 0 && <span className="font-bold text-emerald-700">{activeCount}</span>}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Aktivacija servisera</div>
          </div>

          {loading ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400">Učitavam...</div>
          ) : servicers.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400">Nema servisera.</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {servicers.map((s) => (
                <div key={s.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${s.activeToday ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <span className="text-sm font-medium text-slate-800 truncate">{s.fullName}</span>
                    </div>
                    {s.activeToday ? (
                      <button
                        type="button"
                        className="text-[11px] px-2 py-0.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 font-medium shrink-0"
                        onClick={() => handleDeactivate(s.id)}
                      >
                        Isključi
                      </button>
                    ) : !s.hasPin ? (
                      <span className="text-[10px] text-slate-400 shrink-0">Nema PIN</span>
                    ) : pinFor === s.id ? null : (
                      <button
                        type="button"
                        className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium shrink-0"
                        onClick={() => { setPinFor(s.id); setPinValue(""); setPinError(""); }}
                      >
                        Prijavi se
                      </button>
                    )}
                  </div>

                  {pinFor === s.id && (
                    <div className="mt-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={pinInputRef}
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="PIN"
                          className="input h-8 w-20 text-center text-sm font-mono tracking-widest"
                          value={pinValue}
                          onChange={(e) => { setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter" && pinValue.length === 4) handleActivate(s.id); }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary h-8 px-3 text-xs"
                          disabled={pinValue.length !== 4 || activating}
                          onClick={() => handleActivate(s.id)}
                        >
                          {activating ? "..." : "OK"}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-slate-600"
                          onClick={() => { setPinFor(null); setPinValue(""); setPinError(""); }}
                        >
                          ✕
                        </button>
                      </div>
                      {pinError && <div className="mt-1 text-[11px] text-red-600">{pinError}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
