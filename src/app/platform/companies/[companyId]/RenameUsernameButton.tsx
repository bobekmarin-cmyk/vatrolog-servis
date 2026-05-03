"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  companyId: string;
  accountUserId: string;
  currentUsername: string;
};

export default function RenameUsernameButton({ companyId, accountUserId, currentUsername }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentUsername);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/platform/companies/${encodeURIComponent(companyId)}/accounts/${encodeURIComponent(accountUserId)}/set-username`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ username: value.trim() }),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "Ne mogu preimenovati račun.");
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
          setValue(currentUsername);
          setErr(null);
          setOpen(true);
        }}
      >
        Promijeni username
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="input h-8 w-44 font-mono text-xs"
        value={value}
        onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
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
