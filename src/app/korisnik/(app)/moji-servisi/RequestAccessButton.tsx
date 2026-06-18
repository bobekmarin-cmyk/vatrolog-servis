"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestAccessButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/servicers/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Zahtjev nije uspio.");
        return;
      }
      router.refresh();
    } catch {
      setError("Zahtjev nije uspio.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="inline-flex h-9 items-center rounded-lg bg-red-700 px-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60"
      >
        {loading ? "Šaljem…" : "Zatraži pristup"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
