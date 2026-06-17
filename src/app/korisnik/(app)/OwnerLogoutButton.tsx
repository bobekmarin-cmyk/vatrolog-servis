"use client";

import { useState } from "react";

export default function OwnerLogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-60"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/portal/auth/logout", { method: "POST" });
          const data = (await res.json().catch(() => ({}))) as { redirect?: string };
          window.location.assign(data.redirect ?? "/korisnik/login");
        } catch {
          window.location.assign("/korisnik/login");
        }
      }}
    >
      {busy ? "Odjava…" : "Odjava"}
    </button>
  );
}
