"use client";

import { useState } from "react";

export default function OwnerLogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-outline h-9 text-sm"
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
