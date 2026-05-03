"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RejectRequestForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(
        `/api/platform/registration-requests/${encodeURIComponent(requestId)}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: reason.trim() || null,
            sendEmail,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Odbijanje nije uspjelo.");
        return;
      }
      setInfo("Zahtjev odbijen.");
      router.refresh();
    } catch {
      setError("Greška u komunikaciji s poslužiteljem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label">Razlog (opcionalno, ide u e-mail ako ga šalješ)</label>
        <textarea
          className="input min-h-[80px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          placeholder="Npr. ne radimo trenutno s tim tipom subjekata, kontaktirat ćemo vas naknadno..."
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-rose-800">
        <input
          type="checkbox"
          className="mt-1"
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
        />
        <span>
          Pošalji podnositelju e-mail s pristojnom porukom o odbijanju.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className={`btn px-4 ${confirming ? "btn-primary bg-rose-600 hover:bg-rose-700" : "btn-outline border-rose-300 text-rose-800"}`}
          disabled={busy}
        >
          {busy ? "Odbijam…" : confirming ? "Potvrdi odbijanje" : "Odbij zahtjev"}
        </button>
        {confirming && !busy && (
          <button
            type="button"
            className="btn btn-outline px-3 text-xs"
            onClick={() => setConfirming(false)}
          >
            Odustani
          </button>
        )}
        {info && (
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
            {info}
          </span>
        )}
        {error && (
          <span className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
