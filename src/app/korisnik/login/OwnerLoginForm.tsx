"use client";

import { useState } from "react";

export default function OwnerLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; redirect?: string; error?: string };
      if (res.ok && data.ok && data.redirect) {
        window.location.assign(data.redirect);
        return;
      }
      setError(data.error ?? "Neispravni podaci za prijavu.");
    } catch {
      setError("Greška u komunikaciji. Pokušajte ponovno.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="username" className="input" required disabled={busy} />
        </div>
        <div>
          <label className="label" htmlFor="password">Lozinka</label>
          <input id="password" name="password" type="password" autoComplete="current-password" className="input" required disabled={busy} />
        </div>
        <button className="btn btn-primary h-10 w-full" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Prijava…" : "Prijavi se"}
        </button>
      </form>
    </>
  );
}
