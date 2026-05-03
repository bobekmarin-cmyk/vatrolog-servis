"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MIN_PASSWORD_LENGTH = 10;

export default function SubaccountPasswordSetupForm({
  token,
  username,
}: {
  token: string;
  username: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Lozinka mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova.`);
      return;
    }
    if (password !== confirm) {
      setError("Lozinka i potvrda se ne podudaraju.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/users/subaccount-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Greška kod postavljanja lozinke.");
      return;
    }
    setOk(true);
    setTimeout(() => router.push("/admin/users"), 1500);
  }

  if (ok) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        Lozinka za <strong>{username}</strong> je postavljena. Preusmjeravamo vas na popis korisnika…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label">Nova lozinka</label>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </div>
      <div>
        <label className="label">Potvrdi lozinku</label>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </div>
      <button className="btn btn-primary px-4" type="submit" disabled={busy}>
        {busy ? "Spremam…" : "Postavi lozinku"}
      </button>
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</div>
      )}
    </form>
  );
}
