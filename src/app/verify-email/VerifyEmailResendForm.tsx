"use client";

import { useState } from "react";

export default function VerifyEmailResendForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Greška. Pokušajte ponovno.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Greška u komunikaciji s poslužiteljem.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-4 rounded bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
        Ako za upisanu email adresu postoji račun s nepotvrđenim emailom,
        poslali smo novi link. Provjerite inbox (i spam mapu).
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div>
        <label htmlFor="resend-email" className="block text-sm">
          Email adresa
        </label>
        <input
          id="resend-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary h-10 w-full disabled:opacity-50"
      >
        {submitting ? "Šaljem..." : "Pošalji novu potvrdu"}
      </button>
      {error && <p className="text-sm text-red-700 bg-red-50 p-2 rounded">{error}</p>}
    </form>
  );
}
