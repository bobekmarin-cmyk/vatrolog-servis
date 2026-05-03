"use client";

import { useState } from "react";

export default function PlatformLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    setIsPending(true);

    try {
      const res = await fetch("/api/platform/auth/login", {
        method: "POST",
        body: formData,
        redirect: "follow",
      });

      if (res.status === 401) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Neispravni podaci za prijavu.");
        return;
      }

      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Previše pokušaja. Pričekaj malo pa pokušaj ponovno.");
        return;
      }

      if (res.status === 500) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Greška poslužitelja pri prijavi.");
        return;
      }

      // Uspjeh: API vraća 303 → preglednik prati redirect → dobijemo 200 s URL-om platforme
      if (res.ok && res.url && res.url.includes("/platform/")) {
        window.location.href = res.url;
        return;
      }

      setError("Došlo je do greške. Pokušajte ponovno.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded p-1 text-red-600 hover:bg-red-100"
            aria-label="Zatvori"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="username">
            Korisničko ime
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            className="input"
            required
            disabled={isPending}
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Lozinka
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="input"
            required
            disabled={isPending}
          />
        </div>

        <button className="btn btn-primary h-10 w-full" type="submit" disabled={isPending}>
          {isPending ? "Prijava…" : "Prijavi se"}
        </button>
      </form>
    </>
  );
}
