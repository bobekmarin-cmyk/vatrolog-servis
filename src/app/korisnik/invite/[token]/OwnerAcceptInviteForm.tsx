"use client";

import { useState } from "react";
import Link from "next/link";

export default function OwnerAcceptInviteForm({ token, hasAccount }: { token: string; hasAccount: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(payload: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/portal/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...payload }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        redirect?: string;
        existingAccount?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        if (data.redirect) {
          window.location.assign(data.redirect);
          return;
        }
        setLinked(true);
        return;
      }
      setError(data.error ?? "Greška. Pokušajte ponovno.");
    } catch {
      setError("Greška u komunikaciji.");
    } finally {
      setBusy(false);
    }
  }

  // Postojeći račun: samo poveži pa uputi na prijavu.
  if (hasAccount) {
    if (linked) {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Pristup je povezan s vašim računom. Prijavite se da nastavite.
          </div>
          <Link href="/korisnik/login" className="btn btn-primary h-10 w-full">Idi na prijavu</Link>
        </div>
      );
    }
    return (
      <>
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        <p className="mb-4 text-sm text-slate-600">Već imate račun na ovoj e-mail adresi. Potvrdite da povežemo novi pristup.</p>
        <button className="btn btn-primary h-10 w-full" disabled={busy} onClick={() => submit({})}>
          {busy ? "Povezivanje…" : "Poveži i nastavi"}
        </button>
      </>
    );
  }

  // Novi račun: postavi lozinku.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    await submit({ password, name: fd.get("name") });
  }

  return (
    <>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="name">Ime i prezime (opcionalno)</label>
          <input id="name" name="name" className="input" disabled={busy} />
        </div>
        <div>
          <label className="label" htmlFor="password">Lozinka</label>
          <input id="password" name="password" type="password" autoComplete="new-password" className="input" required disabled={busy} minLength={8} />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Ponovi lozinku</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" required disabled={busy} minLength={8} />
        </div>
        <button className="btn btn-primary h-10 w-full" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Aktivacija…" : "Aktiviraj pristup"}
        </button>
      </form>
    </>
  );
}
