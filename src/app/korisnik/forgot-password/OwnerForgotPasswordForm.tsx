"use client";

import { useState } from "react";

export default function OwnerForgotPasswordForm() {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/portal/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fd.get("email") }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (res.ok && data.ok) {
        setMsg(data.message ?? "Ako postoji račun, poslali smo link.");
      } else {
        setError(data.error ?? "Greška. Pokušajte ponovno.");
      }
    } catch {
      setError("Greška u komunikaciji.");
    } finally {
      setBusy(false);
    }
  }

  if (msg) {
    return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>;
  }

  return (
    <>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" className="input" required disabled={busy} />
        </div>
        <button className="btn btn-primary h-10 w-full" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Slanje…" : "Pošalji link"}
        </button>
      </form>
    </>
  );
}
