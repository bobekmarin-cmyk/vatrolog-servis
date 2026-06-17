"use client";

import { useState } from "react";
import Link from "next/link";

export default function OwnerResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Nedostaje token. Otvorite link iz e-maila.</div>;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 8) {
      setError("Lozinka mora imati barem 8 znakova.");
      return;
    }
    if (password !== confirm) {
      setError("Lozinke se ne podudaraju.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/portal/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setDone(true);
      } else {
        setError(data.error ?? "Greška. Link je možda istekao.");
      }
    } catch {
      setError("Greška u komunikaciji.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Lozinka je postavljena. Sada se možete prijaviti.
        </div>
        <Link href="/korisnik/login" className="btn btn-primary h-10 w-full">Idi na prijavu</Link>
      </div>
    );
  }

  return (
    <>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="password">Nova lozinka</label>
          <input id="password" name="password" type="password" autoComplete="new-password" className="input" required disabled={busy} minLength={8} />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Ponovi lozinku</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" required disabled={busy} minLength={8} />
        </div>
        <button className="btn btn-primary h-10 w-full" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Spremanje…" : "Postavi lozinku"}
        </button>
      </form>
    </>
  );
}
