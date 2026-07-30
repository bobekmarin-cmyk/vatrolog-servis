"use client";

import { useEffect } from "react";

/**
 * Zajednički ekran za `error.tsx` granice.
 *
 * Bez ovoga svaka iznimka na serveru (npr. kratak prekid prema bazi) korisniku
 * prikaže Next.js "Application error" bijelu stranicu bez ijedne akcije.
 */
export default function ErrorBoundaryScreen({
  error,
  reset,
  title = "Nešto je zapelo",
  homeHref = "/",
  homeLabel = "Naslovnica",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        lvl: "error",
        evt: "client_error_boundary",
        message: error.message,
        digest: error.digest ?? null,
      }),
    );
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-700">
          !
        </div>
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Stranica se nije uspjela učitati. Podaci su sigurni — pokušajte ponovno za koji
          trenutak.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary px-4" onClick={() => reset()}>
            Pokušaj ponovno
          </button>
          <a className="btn btn-outline px-4" href={homeHref}>
            {homeLabel}
          </a>
        </div>

        {error.digest ? (
          <p className="mt-4 font-mono text-[11px] text-slate-400">Kod: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
