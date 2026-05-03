"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";

export default function AdjustStockButton({ partId }: { partId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (saving) return;
    setOpen(false);
    setError(null);
    setDelta("");
    setReason("");
  }

  async function submit() {
    const n = Number(delta);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n === 0) {
      setError("Upišite cijeli broj različit od 0 (pozitivan ili negativan).");
      return;
    }
    if (reason.trim().length < 2) {
      setError("Navedite razlog korekcije.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/warehouse/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId, delta: n, reason: reason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Spremanje nije uspjelo.");
      }
      setOpen(false);
      setDelta("");
      setReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary h-10">
        Dodaj korekciju
      </button>

      <Modal
        open={open}
        title="Korekcija stanja"
        variant="neutral"
        size="md"
        onClose={close}
        footer={
          <>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              onClick={close}
              disabled={saving}
            >
              Odustani
            </button>
            <button
              type="button"
              className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              onClick={submit}
              disabled={saving}
            >
              {saving ? "Sprema…" : "Spremi korekciju"}
            </button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Promjena (delta)</label>
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="npr. -1 ili 5"
              className="input h-10 w-full"
              disabled={saving}
            />
            <div className="mt-1 text-xs text-slate-500">
              Pozitivan broj povećava stanje, negativan smanjuje. Stanje smije ići u minus.
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Razlog</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="npr. popis stanja, oštećenje, ispravak unosa…"
              className="input min-h-[72px] w-full"
              disabled={saving}
            />
          </div>
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
