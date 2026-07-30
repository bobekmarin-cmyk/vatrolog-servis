"use client";

import ErrorBoundaryScreen from "@/components/ErrorBoundaryScreen";

export default function CompanyAreaError({
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
      homeHref="/work-orders"
      homeLabel="Nalozi"
    />
  );
}
