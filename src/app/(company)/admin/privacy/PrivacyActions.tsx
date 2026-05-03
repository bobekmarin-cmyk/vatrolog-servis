"use client";

import { useState } from "react";

export default function PrivacyActions(): React.ReactElement {
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleDelete = async (): Promise<void> => {
    setErr(null);
    setMsg(null);
    if (confirm !== "OBRISI") {
      setErr("Za potvrdu upišite točno OBRISI.");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/privacy/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!res.ok) {
        setErr(data?.error ?? "Greška pri brisanju.");
      } else {
        setMsg(data?.message ?? "Zahtjev zaprimljen. Za nekoliko sekundi bit ćete odjavljeni.");
        setTimeout(() => { window.location.href = "/login"; }, 3000);
      }
    } catch {
      setErr("Greška pri brisanju.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <a
          href="/api/admin/privacy/export"
          className="inline-flex items-center rounded-md bg-slate-800 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-900"
        >
          Preuzmi JSON izvoz
        </a>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="font-semibold text-red-700">Nepovratno brisanje tvrtke</h3>
        <p className="text-sm text-slate-700 mt-1">
          Upišite <code className="bg-slate-100 px-1 rounded">OBRISI</code> i kliknite gumb ispod.
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="OBRISI"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={deleting || confirm !== "OBRISI"}
            onClick={handleDelete}
            className="rounded-md bg-red-600 text-white text-sm font-semibold px-4 py-2 hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Brišem..." : "Zatraži brisanje"}
          </button>
        </div>
        {err && <div className="mt-2 text-sm text-red-700">{err}</div>}
        {msg && <div className="mt-2 text-sm text-green-700">{msg}</div>}
      </div>
    </div>
  );
}
