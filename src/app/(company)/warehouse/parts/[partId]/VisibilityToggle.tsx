"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VisibilityToggle({
  partId,
  hidden,
}: {
  partId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/warehouse/parts/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId, hidden: !hidden }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Promjena nije uspjela.");
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
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className={`h-10 w-full rounded-md border text-sm font-medium disabled:opacity-50 ${
          hidden
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {saving ? "Sprema…" : hidden ? "Aktiviraj dio" : "Deaktiviraj dio"}
      </button>
      {error && <div className="mt-1 text-xs text-rose-700">{error}</div>}
    </div>
  );
}
