"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  companyId: string;
  defaultLabelStationary: string;
  defaultLabelVehicle: string;
};

export default function AddAccountButton({
  companyId,
  defaultLabelStationary,
  defaultLabelVehicle,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"STATIONARY" | "VEHICLE">("VEHICLE");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const placeholder = kind === "STATIONARY" ? defaultLabelStationary : defaultLabelVehicle;

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/platform/companies/${encodeURIComponent(companyId)}/accounts/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ kind, label: label.trim() || undefined }),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "Ne mogu kreirati račun.");
        return;
      }
      setOpen(false);
      setLabel("");
      router.refresh();
    } catch {
      setErr("Greška pri spremanju.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-primary h-8 px-3 text-xs"
        onClick={() => {
          setKind("VEHICLE");
          setLabel("");
          setErr(null);
          setOpen(true);
        }}
      >
        + Dodaj novi račun
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs space-y-2">
      <div className="font-semibold text-slate-800">Novi račun za servisnu lokaciju</div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="kind"
            checked={kind === "STATIONARY"}
            onChange={() => setKind("STATIONARY")}
          />
          Stacionarni servis
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="kind"
            checked={kind === "VEHICLE"}
            onChange={() => setKind("VEHICLE")}
          />
          Servisno vozilo
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input h-8 w-64 text-xs"
          placeholder={`Labela (default: ${placeholder})`}
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className="btn btn-primary h-8 px-3 text-xs" onClick={submit} disabled={busy}>
          {busy ? "..." : "Kreiraj račun"}
        </button>
        <button
          className="btn btn-outline h-8 px-3 text-xs"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Odustani
        </button>
      </div>
      <p className="text-[11px] text-slate-600">
        Username će se generirati automatski (sljedeći ordinal po tipu). Setup link odlazi adminu na mail.
      </p>
      {err ? <div className="text-rose-600">{err}</div> : null}
    </div>
  );
}
