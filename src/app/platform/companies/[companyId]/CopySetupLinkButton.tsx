"use client";

import { useState } from "react";

export default function CopySetupLinkButton({
  companyId,
  accountUserId,
  username,
}: {
  companyId: string;
  accountUserId: string;
  username: string;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setCopied(false);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/companies/${companyId}/accounts/${accountUserId}/copy-setup-link`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Greška kod generiranja linka.");
        return;
      }
      const url = String(data.url ?? "");
      if (!url) {
        setError("Link nije vraćen.");
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        const w = window.prompt(`Setup link za ${username}:`, url);
        if (w !== null) setCopied(true);
      }
      setTimeout(() => setCopied(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className="btn btn-outline h-8 px-3 text-xs"
        onClick={onClick}
        disabled={busy}
        title="Generiraj setup link i kopiraj u clipboard (mail se ne šalje)"
      >
        {busy ? "Generiram…" : copied ? "Kopirano ✓" : "Kopiraj setup link"}
      </button>
      {error && <span className="text-[11px] text-rose-700">{error}</span>}
    </div>
  );
}
