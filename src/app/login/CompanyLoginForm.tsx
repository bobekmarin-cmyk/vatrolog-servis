"use client";

import { useState } from "react";

export default function CompanyLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    setIsPending(true);
    let willRedirect = false;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
        redirect: "follow",
        headers: { Accept: "application/json" },
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

      if (res.status === 403) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        setError(
          data.code === "EMAIL_NOT_VERIFIED"
            ? "Email adresa nije potvrđena. Provjerite inbox ili zatražite novu potvrdu na stranici za potvrdu emaila."
            : data.error ?? "Nemate ovlasti za prijavu.",
        );
        return;
      }

      if (res.status === 500) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Greška poslužitelja pri prijavi.");
        return;
      }

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; redirect?: string };
        if (data.ok && data.redirect?.startsWith("/")) {
          // Drži formu disabled dok preglednik dovrši navigaciju.
          // Bez toga `finally` ispod resetira `isPending` prije nego što
          // window.location.assign uspije promijeniti stranicu, pa korisnik
          // vidi "Prijava…" -> "Prijavi se" -> redirect (zbunjujuće).
          willRedirect = true;
          setIsRedirecting(true);
          window.location.assign(data.redirect);
          return;
        }
        if (res.url) {
          const path = new URL(res.url).pathname;
          if (path !== "/login") {
            willRedirect = true;
            setIsRedirecting(true);
            window.location.href = res.url;
            return;
          }
        }
      }

      setError("Došlo je do greške. Pokušajte ponovno.");
    } finally {
      if (!willRedirect) setIsPending(false);
    }
  }

  const busy = isPending || isRedirecting;
  const buttonLabel = isRedirecting ? "Preusmjeravanje…" : isPending ? "Prijava…" : "Prijavi se";

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

      <form
        className="space-y-4"
        onSubmit={handleSubmit}
        method="post"
        action="/api/auth/login"
      >
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
            disabled={busy}
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
            disabled={busy}
          />
        </div>

        <button
          className="btn btn-primary h-10 w-full"
          type="submit"
          disabled={busy}
          aria-busy={busy}
        >
          {buttonLabel}
        </button>
      </form>
    </>
  );
}
