"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MinStockEditor({ partId, initial }: { partId: string; initial: number }) {
  const router = useRouter();
  const [value, setValue] = useState<string>(String(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      setError("Mora biti cijeli broj ≥ 0.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/warehouse/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId, minStockQty: n }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Spremanje nije uspjelo.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input h-9 w-24 text-2xl font-bold tabular-nums"
          disabled={saving}
        />
        <button
          type="button"
          onClick={save}
          disabled={saving || String(initial) === value}
          className="btn btn-outline h-9"
        >
          {saving ? "Sprema…" : "Spremi"}
        </button>
      </div>
      {error && <div className="mt-1 text-xs text-rose-700">{error}</div>}
    </div>
  );
}
