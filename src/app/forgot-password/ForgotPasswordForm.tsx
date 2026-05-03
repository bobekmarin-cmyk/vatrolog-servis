"use client";

import { useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Greška. Pokušajte ponovno.");
      } else {
        setMessage(data.message ?? "Ako postoji račun, poslan je link za reset.");
      }
    } catch {
      setError("Greška u komunikaciji s poslužiteljem.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="vase.ime@primjer.hr"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-red-600 text-white py-2 font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {submitting ? "Šaljemo..." : "Pošalji link za reset"}
      </button>

      {message && <p className="text-sm text-green-700 bg-green-50 p-2 rounded">{message}</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 p-2 rounded">{error}</p>}
    </form>
  );
}
