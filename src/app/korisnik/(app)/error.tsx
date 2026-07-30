"use client";

import ErrorBoundaryScreen from "@/components/ErrorBoundaryScreen";

export default function PortalAreaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryScreen
      error={error}
      reset={reset}
      title="Stranica se nije učitala"
      homeHref="/korisnik"
      homeLabel="Moji aparati"
    />
  );
}
