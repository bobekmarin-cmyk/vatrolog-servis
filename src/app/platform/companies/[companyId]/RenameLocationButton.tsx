"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  companyId: string;
  locationId: string;
  currentLabel: string;
};

export default function RenameLocationButton({ companyId, locationId, currentLabel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentLabel);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/platform/companies/${encodeURIComponent(companyId)}/locations/${encodeURIComponent(locationId)}/rename`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ label: value.trim() }),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "Ne mogu promijeniti labelu.");
        return;
      }
      setOpen(false);
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
        className="btn btn-outline h-8 px-3 text-xs"
        onClick={() => {
          setValue(currentLabel);
          setErr(null);
          setOpen(true);
        }}
      >
        Promijeni labelu
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="input h-8 w-56 text-xs"
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button className="btn btn-primary h-8 px-3 text-xs" onClick={submit} disabled={busy}>
        {busy ? "..." : "Spremi"}
      </button>
      <button
        className="btn btn-outline h-8 px-3 text-xs"
        onClick={() => setOpen(false)}
        disabled={busy}
      >
        Odustani
      </button>
      {err ? <span className="text-xs text-rose-600">{err}</span> : null}
    </div>
  );
}
