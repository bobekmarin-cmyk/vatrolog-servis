"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Org = { ownerOrgId: string; oib: string; name: string | null };

export default function OwnerOrgPicker({ orgs }: { orgs: Org[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(ownerOrgId: string) {
    setBusyId(ownerOrgId);
    setError(null);
    try {
      const res = await fetch("/api/portal/active-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerOrgId }),
      });
      const data = (await res.json()) as { ok?: boolean; redirect?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Greška.");
        setBusyId(null);
        return;
      }
      router.replace(data.redirect ?? "/korisnik");
    } catch {
      setError("Greška u komunikaciji.");
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {orgs.map((o) => (
        <button
          key={o.ownerOrgId}
          type="button"
          disabled={busyId !== null}
          onClick={() => pick(o.ownerOrgId)}
          className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-red-300 hover:bg-red-50/50 disabled:opacity-60"
        >
          <div>
            <div className="font-semibold text-slate-900">{o.name ?? "Vlasnik"}</div>
            <div className="text-sm text-slate-500">OIB: {o.oib}</div>
          </div>
          <span className="text-sm font-medium text-red-700">
            {busyId === o.ownerOrgId ? "Otvaram…" : "Otvori →"}
          </span>
        </button>
      ))}
      {error ? <div className="text-sm text-red-700">{error}</div> : null}
    </div>
  );
}
